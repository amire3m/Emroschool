import prisma from "@/lib/prisma";
import { answerPreCheckoutQuery, sendInvoice } from "@/lib/bale-payment";
import { processBalePreCheckout, processBaleSuccessfulPayment } from "@/lib/bale-payment-finalization";
import { effectiveBaleExpiry, isExpired } from "@/lib/bale-payment-domain";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function payerDetails(from: unknown) {
  if (!from || typeof from !== "object") return {};
  const sender = from as { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown };
  const payerBaleId = typeof sender.id === "string" || typeof sender.id === "number" ? String(sender.id) : undefined;
  const fullName = [sender.first_name, sender.last_name].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ");
  const payerBaleName = fullName || (typeof sender.username === "string" && sender.username.trim() ? sender.username.trim() : undefined);
  return { ...(payerBaleId ? { payerBaleId } : {}), ...(payerBaleName ? { payerBaleName } : {}) };
}

type BaleWebhookDependencies = {
  db: any;
  now: () => Date;
  webhookSecret?: string;
  sendInvoice: typeof sendInvoice;
  answerPreCheckoutQuery: typeof answerPreCheckoutQuery;
  onError: (error: unknown) => void;
};

const defaultDependencies: BaleWebhookDependencies = {
  db: prisma,
  now: () => new Date(),
  sendInvoice,
  answerPreCheckoutQuery,
  onError: (error) => console.error("Bale webhook error:", error),
};

export async function POST(
  req: NextRequest,
  { params }: { params: { secret: string } },
  overrides: Partial<BaleWebhookDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const webhookSecret = overrides.webhookSecret ?? process.env.BALE_WEBHOOK_SECRET;
  if (!webhookSecret || params.secret !== webhookSecret) return new NextResponse(null, { status: 404 });
  try {
    const update = await req.json();
    const startText = update?.message?.text;
    if (typeof startText === "string" && startText.startsWith("/start ")) {
      const payload = startText.slice(7).trim();
      const chatId = String(update?.message?.chat?.id || "");
      const attempt = await dependencies.db.paymentAttempt.findUnique({ where: { balePayload: payload }, include: { order: { include: { course: true } } } });
      const now = dependencies.now();
      const expiresAt = attempt?.createdAt instanceof Date ? effectiveBaleExpiry(attempt.expiresAt, attempt.createdAt) : null;
      if (attempt && chatId && attempt.method === "bale_wallet" && attempt.status === "pending" && attempt.order.status !== "paid" && attempt.order.activeAttemptId === attempt.id && expiresAt && !isExpired(expiresAt, now)) {
         const claimId = crypto.randomUUID();
         const claimed = await dependencies.db.paymentAttempt.updateMany({
           where: {
             id: attempt.id,
             orderId: attempt.order.id,
             status: "pending",
             baleInvoiceSentAt: null,
             baleInvoiceClaimId: null,
           },
           data: { baleInvoiceClaimId: claimId, baleInvoiceClaimedAt: now, expiresAt },
         });
         if (claimed.count !== 1) return NextResponse.json({ ok: true });
         try {
           await dependencies.db.paymentOrder.update({ where: { id: attempt.order.id }, data: { baleChatId: chatId } });
           await dependencies.sendInvoice(chatId, { title: attempt.order.course.title, description: `پرداخت دوره ${attempt.order.course.title}`, payload, amountRials: attempt.amountRials });
         } catch (error) {
           await dependencies.db.paymentAttempt.updateMany({
             where: { id: attempt.id, orderId: attempt.order.id, baleInvoiceClaimId: claimId },
             data: { baleInvoiceClaimId: null, baleInvoiceClaimedAt: null },
           });
           throw error;
      }
         await dependencies.db.paymentAttempt.updateMany({
           where: { id: attempt.id, orderId: attempt.order.id, baleInvoiceClaimId: claimId },
           data: { baleInvoiceSentAt: now, baleInvoiceClaimId: null, baleInvoiceClaimedAt: null },
         });
       }
      return NextResponse.json({ ok: true });
    }
    const preCheckout = update?.pre_checkout_query;
    if (preCheckout) {
      const valid = await processBalePreCheckout(dependencies.db, {
        id: String(preCheckout.id || ""),
        invoicePayload: preCheckout.invoice_payload,
        currency: preCheckout.currency,
        totalAmount: preCheckout.total_amount,
        checkedAt: dependencies.now(),
      });
      await dependencies.answerPreCheckoutQuery(preCheckout.id, valid, valid ? undefined : "اطلاعات پرداخت معتبر نیست.");
      return NextResponse.json({ ok: true });
    }

    const payment = update?.message?.successful_payment;
    if (!payment) return NextResponse.json({ ok: true });
    await processBaleSuccessfulPayment(dependencies.db, {
      invoicePayload: payment.invoice_payload,
      currency: payment.currency,
      totalAmount: payment.total_amount,
      balePaymentId: String(payment.telegram_payment_charge_id || ""),
      baleTrackingNumber: String(payment.provider_payment_charge_id || ""),
      paidAt: dependencies.now(),
      ...payerDetails(update?.message?.from),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    dependencies.onError(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
