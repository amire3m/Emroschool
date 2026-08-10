import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getIranianCardInfo } from "@/lib/iranian-card";
import { encryptPaymentCard } from "@/lib/payment-card-crypto";
import { isExpired, newBaleExpiry } from "@/lib/bale-payment-domain";

function userId(req: NextRequest) {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? verifyToken(header.slice(7))?.id : null;
}

async function cardInstructions() {
  const settings = await prisma.paymentSettings.findUnique({ where: { id: 1 } });
  return settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined;
}

export async function POST(req: NextRequest) {
  const id = userId(req);
  if (!id) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { applicationId, method, payerCardNumber } = await req.json();
    if (!applicationId) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const application = await prisma.courseApplication.findUnique({ where: { id: applicationId }, include: { course: true, paymentOrder: true } });
    if (!application || application.userId !== id) return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    if (!['pending', 'pending_payment'].includes(application.status) || !application.course.published || application.course.scheduleStatus !== "upcoming") return NextResponse.json({ error: "این درخواست قابل پرداخت نیست" }, { status: 400 });
    const discount = application.discountCode ? await prisma.discountCode.findUnique({ where: { code: application.discountCode } }) : null;
    if (discount?.requiresDocument && !application.discountDocumentUrl) return NextResponse.json({ error: "بارگذاری مدرک تخفیف الزامی است" }, { status: 400 });
    if (application.paymentOrder) {
      const order = await prisma.paymentOrder.findUnique({ where: { id: application.paymentOrder.id }, include: { attempts: { orderBy: { sequence: "desc" } } } });
      return NextResponse.json({ order, paymentInstructions: application.paymentOrder.method === "card_to_card" ? await cardInstructions() : undefined, existing: true });
    }
    const course = application.course;
    if (application.finalAmountTomans === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.courseApplication.update({ where: { id: application.id }, data: { status: "approved" } });
        await tx.enrollment.upsert({ where: { userId_courseId: { userId: id, courseId: course.id } }, update: {}, create: { userId: id, courseId: course.id } });
      });
      return NextResponse.json({ complete: true });
    }
    if (!["card_to_card", "bale_wallet"].includes(method)) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const payerCard = method === "card_to_card" ? getIranianCardInfo(String(payerCardNumber || "")) : null;
    if (method === "card_to_card" && !payerCard) return NextResponse.json({ error: "شماره کارت پرداخت‌کننده معتبر نیست" }, { status: 400 });

    const now = new Date();
    const expiresAt = method === "bale_wallet" ? newBaleExpiry(now) : null;
    const orderNumber = `PAY-${now.getTime()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const payload = method === "bale_wallet" ? `payment:${orderNumber}:${crypto.randomBytes(16).toString("hex")}` : null;
    const order = await prisma.paymentOrder.create({ data: { orderNumber, amountTomans: application.finalAmountTomans, amountRials: application.finalAmountTomans * 10, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", balePayload: payload, expiresAt, ...(payerCard ? { payerCardEncrypted: encryptPaymentCard(payerCard.cardNumber), payerCardMasked: payerCard.maskedCardNumber, payerBankName: payerCard.bankName, payerBankSlug: payerCard.bankSlug } : {}), userId: id, courseId: course.id, applicationId: application.id, attempts: { create: { sequence: 1, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", amountTomans: application.finalAmountTomans, amountRials: application.finalAmountTomans * 10, balePayload: payload, expiresAt } } } });
    const attempt = await prisma.paymentAttempt.findFirst({ where: { orderId: order.id }, orderBy: { sequence: "desc" } });
    if (attempt) await prisma.paymentOrder.update({ where: { id: order.id }, data: { activeAttemptId: attempt.id } });
    const settings = method === "card_to_card" ? await prisma.paymentSettings.findUnique({ where: { id: 1 } }) : null;
    const botUsername = process.env.BALE_BOT_USERNAME || "imamruhollahschool_bot";
    return NextResponse.json({ order, baleBotUrl: method === "bale_wallet" ? `https://ble.ir/${botUsername}?start=${encodeURIComponent(payload!)}` : undefined, paymentInstructions: settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BALE_NOT_CONFIGURED") return NextResponse.json({ error: "پرداخت بله پیکربندی نشده است" }, { status: 503 });
    if (error instanceof Error && error.message === "PAYMENT_CARD_KEY_MISSING") return NextResponse.json({ error: "ثبت امن کارت پرداخت‌کننده هنوز پیکربندی نشده است" }, { status: 503 });
    console.error("Payment creation error:", error);
    return NextResponse.json({ error: "ایجاد سفارش انجام نشد" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = userId(req);
  if (!id) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
    const applicationId = new URL(req.url).searchParams.get("applicationId");
    const query = { where: { userId: id, ...(applicationId ? { applicationId } : {}) }, include: { course: { select: { id: true, title: true, slug: true, thumbnail: true } }, application: { select: { id: true, status: true, finalAmountTomans: true } }, attempts: { orderBy: { sequence: "desc" as const } } }, orderBy: { createdAt: "desc" as const } };
    let orders = await prisma.paymentOrder.findMany(query);
    const now = new Date();
    const stale = orders.filter((order) => order.method === "bale_wallet" && order.status === "pending" && order.expiresAt instanceof Date && isExpired(order.expiresAt, now));
    for (const order of stale) {
      await prisma.$transaction(async (tx) => {
        const current = await tx.paymentOrder.findFirst({ where: { id: order.id, userId: id } });
        if (!current || current.status === "paid" || current.method !== "bale_wallet" || current.status !== "pending" || !(current.expiresAt instanceof Date) || !isExpired(current.expiresAt, now)) return;
        const attempt = current.activeAttemptId ? await tx.paymentAttempt.findUnique({ where: { id: current.activeAttemptId } }) : null;
        if (!attempt || attempt.status === "paid" || attempt.method !== "bale_wallet" || attempt.status !== "pending" || !(attempt.expiresAt instanceof Date) || !isExpired(attempt.expiresAt, now)) return;
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "expired", invalidatedAt: now } });
        await tx.paymentOrder.update({ where: { id: current.id }, data: { status: "expired" } });
      });
    }
    if (stale.length > 0) orders = await prisma.paymentOrder.findMany(query);
    const instructions = orders[0]?.method === "card_to_card" ? await cardInstructions() : undefined;
    return NextResponse.json({ orders, paymentInstructions: instructions });
}
