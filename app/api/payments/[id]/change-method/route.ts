import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { method } = await req.json();
    if (!["card_to_card", "bale_wallet"].includes(method)) return NextResponse.json({ error: "روش پرداخت نامعتبر است" }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findFirst({ where: { id: params.id, userId: user.id }, include: { attempts: { orderBy: { sequence: "desc" }, take: 1 } } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.status === "paid") throw new Error("PAID");
      if (order.status === "under_review") throw new Error("UNDER_REVIEW");
      if (order.method === method && order.status !== "rejected") throw new Error("SAME_METHOD");
      const active = order.attempts[0];
      if (active) await tx.paymentAttempt.update({ where: { id: active.id }, data: { status: "invalidated", invalidatedAt: new Date() } });
      const payload = method === "bale_wallet" ? `payment:${order.orderNumber}:${crypto.randomBytes(16).toString("hex")}` : null;
      const attempt = await tx.paymentAttempt.create({ data: { orderId: order.id, sequence: (active?.sequence || 0) + 1, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", amountTomans: order.amountTomans, amountRials: order.amountRials, balePayload: payload } });
      const updated = await tx.paymentOrder.update({ where: { id: order.id }, data: { method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", balePayload: payload, baleChatId: null, baleInvoiceUrl: null, receiptUrl: null, receiptSubmittedAt: null, rejectionReason: null, reviewedAt: null, reviewerId: null, activeAttemptId: attempt.id } });
      return { order: updated, attempt };
    });
    const settings = result.order.method === "card_to_card" ? await prisma.paymentSettings.findUnique({ where: { id: 1 } }) : null;
    const botUsername = process.env.BALE_BOT_USERNAME || "imamruhollahschool_bot";
    return NextResponse.json({ ...result, baleBotUrl: result.order.method === "bale_wallet" ? `https://ble.ir/${botUsername}?start=${encodeURIComponent(result.attempt.balePayload || "")}` : undefined, paymentInstructions: settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined });
  } catch (error) {
    const messages: Record<string, [string, number]> = { NOT_FOUND: ["سفارش پیدا نشد", 404], PAID: ["پس از پرداخت موفق امکان تغییر روش وجود ندارد", 409], UNDER_REVIEW: ["رسید شما در حال بررسی است و فعلاً امکان تغییر روش وجود ندارد", 409], SAME_METHOD: ["همین روش پرداخت انتخاب شده است", 400] };
    const code = error instanceof Error ? error.message : "";
    if (messages[code]) return NextResponse.json({ error: messages[code][0] }, { status: messages[code][1] });
    return NextResponse.json({ error: "تغییر روش پرداخت انجام نشد" }, { status: 500 });
  }
}
