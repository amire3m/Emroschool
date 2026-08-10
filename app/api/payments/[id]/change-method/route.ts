import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getIranianCardInfo } from "@/lib/iranian-card";
import { encryptPaymentCard } from "@/lib/payment-card-crypto";
import { effectiveBaleExpiry, isExpired, newBaleExpiry } from "@/lib/bale-payment-domain";
import { runPaymentTransaction } from "@/lib/payment-transaction";

type ChangeMethodDependencies = { db: any; now: () => Date };

const defaultDependencies: ChangeMethodDependencies = { db: prisma, now: () => new Date() };

export async function POST(req: NextRequest, { params }: { params: { id: string } }, overrides: Partial<ChangeMethodDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { method, payerCardNumber } = await req.json();
    if (!["card_to_card", "bale_wallet"].includes(method)) return NextResponse.json({ error: "روش پرداخت نامعتبر است" }, { status: 400 });
    const payerCard = method === "card_to_card" ? getIranianCardInfo(String(payerCardNumber || "")) : null;
    if (method === "card_to_card" && !payerCard) return NextResponse.json({ error: "شماره کارت پرداخت‌کننده معتبر نیست" }, { status: 400 });
    const originalOrder = await dependencies.db.paymentOrder.findFirst({ where: { id: params.id, userId: user.id } });
    if (!originalOrder) throw new Error("NOT_FOUND");
    const originalActive = originalOrder.activeAttemptId ? await dependencies.db.paymentAttempt.findFirst({ where: { id: originalOrder.activeAttemptId, orderId: originalOrder.id } }) : null;
    const originalLatest = await dependencies.db.paymentAttempt.findFirst({ where: { orderId: originalOrder.id }, orderBy: { sequence: "desc" } });
    const originalSnapshot = {
      activeAttemptId: originalOrder.activeAttemptId,
      orderStatus: originalOrder.status,
      orderMethod: originalOrder.method,
      activeStatus: originalActive?.status || null,
      activeMethod: originalActive?.method || null,
      latestSequence: originalLatest?.sequence || 0,
    };
    const result = await runPaymentTransaction(dependencies.db, async (tx) => {
      const order = await tx.paymentOrder.findFirst({ where: { id: params.id, userId: user.id } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.status === "paid") throw new Error("PAID");
      if (order.status === "under_review") throw new Error("UNDER_REVIEW");
      const active = order.activeAttemptId ? await tx.paymentAttempt.findFirst({ where: { id: order.activeAttemptId, orderId: order.id } }) : null;
      const latest = await tx.paymentAttempt.findFirst({ where: { orderId: order.id }, orderBy: { sequence: "desc" } });
      const stateChanged = order.activeAttemptId !== originalSnapshot.activeAttemptId ||
        order.status !== originalSnapshot.orderStatus ||
        order.method !== originalSnapshot.orderMethod ||
        (active?.status || null) !== originalSnapshot.activeStatus ||
        (active?.method || null) !== originalSnapshot.activeMethod ||
        (latest?.sequence || 0) !== originalSnapshot.latestSequence;
      if (stateChanged) throw new Error("RESTART_CONFLICT");
      const now = dependencies.now();
      if (active?.method === "bale_wallet" && active.status === "pending" && active.createdAt instanceof Date) {
        const legacyExpiry = effectiveBaleExpiry(active.expiresAt, active.createdAt);
        if (isExpired(legacyExpiry, now)) {
          const expired = await tx.paymentAttempt.updateMany({
            where: { id: active.id, orderId: order.id },
            data: { status: "expired", expiresAt: legacyExpiry, invalidatedAt: now },
          });
          if (expired.count !== 1) throw Object.assign(new Error("Active attempt changed"), { code: "P2034" });
          active.status = "expired";
        }
      }
      if (order.method === method && order.status !== "rejected" && active && active.status !== "expired") throw new Error("SAME_METHOD");
      if (active && active.status !== "expired") {
        const invalidated = await tx.paymentAttempt.updateMany({ where: { id: active.id, orderId: order.id }, data: { status: "invalidated", invalidatedAt: now } });
        if (invalidated.count !== 1) throw Object.assign(new Error("Active attempt changed"), { code: "P2034" });
      }
      const payload = method === "bale_wallet" ? `payment:${order.orderNumber}:${crypto.randomBytes(16).toString("hex")}` : null;
      const expiresAt = method === "bale_wallet" ? newBaleExpiry(now) : null;
      const attempt = await tx.paymentAttempt.create({ data: { orderId: order.id, sequence: (latest?.sequence || 0) + 1, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", amountTomans: order.amountTomans, amountRials: order.amountRials, balePayload: payload, expiresAt } });
      const updated = await tx.paymentOrder.update({ where: { id: order.id, activeAttemptId: order.activeAttemptId }, data: { method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", balePayload: payload, expiresAt, baleChatId: null, baleInvoiceUrl: null, receiptUrl: null, receiptSubmittedAt: null, rejectionReason: null, reviewedAt: null, reviewerId: null, ...(payerCard ? { payerCardEncrypted: encryptPaymentCard(payerCard.cardNumber), payerCardMasked: payerCard.maskedCardNumber, payerBankName: payerCard.bankName, payerBankSlug: payerCard.bankSlug } : { payerCardEncrypted: null, payerCardMasked: null, payerBankName: null, payerBankSlug: null }), activeAttemptId: attempt.id } });
      return { order: updated, attempt };
    }, { retryUniqueConflict: true });
    const settings = result.order.method === "card_to_card" ? await dependencies.db.paymentSettings.findUnique({ where: { id: 1 } }) : null;
    const botUsername = process.env.BALE_BOT_USERNAME || "imamruhollahschool_bot";
    return NextResponse.json({ ...result, baleBotUrl: result.order.method === "bale_wallet" ? `https://ble.ir/${botUsername}?start=${encodeURIComponent(result.attempt.balePayload || "")}` : undefined, paymentInstructions: settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_CARD_KEY_MISSING") return NextResponse.json({ error: "ثبت امن کارت پرداخت‌کننده هنوز پیکربندی نشده است" }, { status: 503 });
    if (["P2002", "P2025", "P2034"].includes(String((error as { code?: unknown })?.code || ""))) return NextResponse.json({ error: "درخواست همزمان دیگری روش پرداخت را تغییر داد؛ وضعیت را دوباره دریافت کنید" }, { status: 409 });
    const messages: Record<string, [string, number]> = { NOT_FOUND: ["سفارش پیدا نشد", 404], PAID: ["پس از پرداخت موفق امکان تغییر روش وجود ندارد", 409], UNDER_REVIEW: ["رسید شما در حال بررسی است و فعلاً امکان تغییر روش وجود ندارد", 409], SAME_METHOD: ["همین روش پرداخت انتخاب شده است", 400], RESTART_CONFLICT: ["درخواست همزمان دیگری روش پرداخت را تغییر داد؛ وضعیت را دوباره دریافت کنید", 409] };
    const code = error instanceof Error ? error.message : "";
    if (messages[code]) return NextResponse.json({ error: messages[code][0] }, { status: messages[code][1] });
    return NextResponse.json({ error: "تغییر روش پرداخت انجام نشد" }, { status: 500 });
  }
}
