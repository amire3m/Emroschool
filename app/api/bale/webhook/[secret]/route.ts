import prisma from "@/lib/prisma";
import { answerPreCheckoutQuery, sendInvoice } from "@/lib/bale-payment";
import { processBalePreCheckout, processBaleSuccessfulPayment } from "@/lib/bale-payment-finalization";
import { NextRequest, NextResponse } from "next/server";

function payerDetails(from: unknown) {
  if (!from || typeof from !== "object") return {};
  const sender = from as { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown };
  const payerBaleId = typeof sender.id === "string" || typeof sender.id === "number" ? String(sender.id) : undefined;
  const fullName = [sender.first_name, sender.last_name].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ");
  const payerBaleName = fullName || (typeof sender.username === "string" && sender.username.trim() ? sender.username.trim() : undefined);
  return { ...(payerBaleId ? { payerBaleId } : {}), ...(payerBaleName ? { payerBaleName } : {}) };
}

export async function POST(req: NextRequest, { params }: { params: { secret: string } }) {
  if (!process.env.BALE_WEBHOOK_SECRET || params.secret !== process.env.BALE_WEBHOOK_SECRET) return new NextResponse(null, { status: 404 });
  try {
    const update = await req.json();
    const startText = update?.message?.text;
    if (typeof startText === "string" && startText.startsWith("/start ")) {
      const payload = startText.slice(7).trim();
      const chatId = String(update?.message?.chat?.id || "");
      const attempt = await prisma.paymentAttempt.findUnique({ where: { balePayload: payload }, include: { order: { include: { course: true } } } });
      if (attempt && chatId && attempt.method === "bale_wallet" && attempt.status === "pending" && attempt.order.status !== "paid" && attempt.order.activeAttemptId === attempt.id) {
        await prisma.paymentOrder.update({ where: { id: attempt.order.id }, data: { baleChatId: chatId } });
        await sendInvoice(chatId, { title: attempt.order.course.title, description: `پرداخت دوره ${attempt.order.course.title}`, payload, amountRials: attempt.amountRials });
        await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { baleInvoiceSentAt: new Date() } });
      }
      return NextResponse.json({ ok: true });
    }
    const preCheckout = update?.pre_checkout_query;
    if (preCheckout) {
      const valid = await processBalePreCheckout(prisma, {
        id: String(preCheckout.id || ""),
        invoicePayload: preCheckout.invoice_payload,
        currency: preCheckout.currency,
        totalAmount: preCheckout.total_amount,
      });
      await answerPreCheckoutQuery(preCheckout.id, valid, valid ? undefined : "اطلاعات پرداخت معتبر نیست.");
      return NextResponse.json({ ok: true });
    }

    const payment = update?.message?.successful_payment;
    if (!payment) return NextResponse.json({ ok: true });
    await processBaleSuccessfulPayment(prisma, {
      invoicePayload: payment.invoice_payload,
      currency: payment.currency,
      totalAmount: payment.total_amount,
      balePaymentId: String(payment.telegram_payment_charge_id || ""),
      baleTrackingNumber: String(payment.provider_payment_charge_id || ""),
      ...payerDetails(update?.message?.from),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Bale webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
