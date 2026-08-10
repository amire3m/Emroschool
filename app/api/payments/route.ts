import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getIranianCardInfo } from "@/lib/iranian-card";
import { encryptPaymentCard } from "@/lib/payment-card-crypto";
import { isExpired, newBaleExpiry } from "@/lib/bale-payment-domain";
import { runPaymentTransaction } from "@/lib/payment-transaction";

type PaymentRouteDependencies = { db: any; now: () => Date; onError: (error: unknown) => void; botUsername: () => string };

const defaultDependencies: PaymentRouteDependencies = {
  db: prisma,
  now: () => new Date(),
  onError: (error) => console.error("Payment creation error:", error),
  botUsername: () => process.env.BALE_BOT_USERNAME || "imamruhollahschool_bot",
};

function userId(req: NextRequest) {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? verifyToken(header.slice(7))?.id : null;
}

async function cardInstructions(db: any) {
  const settings = await db.paymentSettings.findUnique({ where: { id: 1 } });
  return settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined;
}

export async function POST(req: NextRequest, _context: { params: Record<string, string> } = { params: {} }, overrides: Partial<PaymentRouteDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const id = userId(req);
  if (!id) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { applicationId, method, payerCardNumber } = await req.json();
    if (!applicationId) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const application = await dependencies.db.courseApplication.findUnique({ where: { id: applicationId }, include: { course: true, paymentOrder: true } });
    if (!application || application.userId !== id) return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    if (!["pending", "pending_payment"].includes(application.status) || !application.course.published || application.course.scheduleStatus !== "upcoming") return NextResponse.json({ error: "این درخواست قابل پرداخت نیست" }, { status: 400 });
    const discount = application.discountCode ? await dependencies.db.discountCode.findUnique({ where: { code: application.discountCode } }) : null;
    if (discount?.requiresDocument && !application.discountDocumentUrl) return NextResponse.json({ error: "بارگذاری مدرک تخفیف الزامی است" }, { status: 400 });
    if (application.paymentOrder) {
      const order = await dependencies.db.paymentOrder.findUnique({ where: { id: application.paymentOrder.id }, include: { attempts: { orderBy: { sequence: "desc" } } } });
      return NextResponse.json({ order, paymentInstructions: application.paymentOrder.method === "card_to_card" ? await cardInstructions(dependencies.db) : undefined, existing: true });
    }
    const course = application.course;
    if (application.finalAmountTomans === 0) {
      await runPaymentTransaction(dependencies.db, async (tx) => {
        await tx.courseApplication.update({ where: { id: application.id }, data: { status: "approved" } });
        await tx.enrollment.upsert({ where: { userId_courseId: { userId: id, courseId: course.id } }, update: {}, create: { userId: id, courseId: course.id } });
      });
      return NextResponse.json({ complete: true });
    }
    if (!["card_to_card", "bale_wallet"].includes(method)) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const payerCard = method === "card_to_card" ? getIranianCardInfo(String(payerCardNumber || "")) : null;
    if (method === "card_to_card" && !payerCard) return NextResponse.json({ error: "شماره کارت پرداخت‌کننده معتبر نیست" }, { status: 400 });

    const now = dependencies.now();
    const expiresAt = method === "bale_wallet" ? newBaleExpiry(now) : null;
    const orderNumber = `PAY-${now.getTime()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const payload = method === "bale_wallet" ? `payment:${orderNumber}:${crypto.randomBytes(16).toString("hex")}` : null;
    const order = await runPaymentTransaction(dependencies.db, async (tx) => {
      const created = await tx.paymentOrder.create({ data: { orderNumber, amountTomans: application.finalAmountTomans, amountRials: application.finalAmountTomans * 10, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", balePayload: payload, expiresAt, ...(payerCard ? { payerCardEncrypted: encryptPaymentCard(payerCard.cardNumber), payerCardMasked: payerCard.maskedCardNumber, payerBankName: payerCard.bankName, payerBankSlug: payerCard.bankSlug } : {}), userId: id, courseId: course.id, applicationId: application.id, attempts: { create: { sequence: 1, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", amountTomans: application.finalAmountTomans, amountRials: application.finalAmountTomans * 10, balePayload: payload, expiresAt } } } });
      const attempt = await tx.paymentAttempt.findFirst({ where: { orderId: created.id }, orderBy: { sequence: "desc" } });
      if (!attempt) throw new Error("PAYMENT_ATTEMPT_MISSING");
      return tx.paymentOrder.update({ where: { id: created.id }, data: { activeAttemptId: attempt.id } });
    });
    const settings = method === "card_to_card" ? await dependencies.db.paymentSettings.findUnique({ where: { id: 1 } }) : null;
    const botUsername = dependencies.botUsername();
    return NextResponse.json({ order, baleBotUrl: method === "bale_wallet" ? `https://ble.ir/${botUsername}?start=${encodeURIComponent(payload!)}` : undefined, paymentInstructions: settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BALE_NOT_CONFIGURED") return NextResponse.json({ error: "پرداخت بله پیکربندی نشده است" }, { status: 503 });
    if (error instanceof Error && error.message === "PAYMENT_CARD_KEY_MISSING") return NextResponse.json({ error: "ثبت امن کارت پرداخت‌کننده هنوز پیکربندی نشده است" }, { status: 503 });
    dependencies.onError(error);
    return NextResponse.json({ error: "ایجاد سفارش انجام نشد" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, _context: { params: Record<string, string> } = { params: {} }, overrides: Partial<PaymentRouteDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const id = userId(req);
  if (!id) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  const applicationId = new URL(req.url).searchParams.get("applicationId");
  const query = { where: { userId: id, ...(applicationId ? { applicationId } : {}) }, include: { course: { select: { id: true, title: true, slug: true, thumbnail: true } }, application: { select: { id: true, status: true, finalAmountTomans: true } }, attempts: { orderBy: { sequence: "desc" as const } } }, orderBy: { createdAt: "desc" as const } };
  let orders = await dependencies.db.paymentOrder.findMany(query);
  const now = dependencies.now();
  const stale = orders.filter((order: any) => order.method === "bale_wallet" && order.status === "pending" && order.expiresAt instanceof Date && isExpired(order.expiresAt, now));
  for (const order of stale) {
    await runPaymentTransaction(dependencies.db, async (tx) => {
      const current = await tx.paymentOrder.findFirst({ where: { id: order.id, userId: id } });
      if (!current || current.status === "paid" || current.method !== "bale_wallet" || current.status !== "pending" || !(current.expiresAt instanceof Date) || !isExpired(current.expiresAt, now)) return;
      const attempt = current.activeAttemptId ? await tx.paymentAttempt.findFirst({ where: { id: current.activeAttemptId, orderId: current.id } }) : null;
      if (!attempt || attempt.status === "paid" || attempt.method !== "bale_wallet" || attempt.status !== "pending" || !(attempt.expiresAt instanceof Date) || !isExpired(attempt.expiresAt, now)) return;
      const updated = await tx.paymentAttempt.updateMany({ where: { id: attempt.id, orderId: current.id }, data: { status: "expired", invalidatedAt: now } });
      if (updated.count !== 1) throw Object.assign(new Error("Active attempt changed"), { code: "P2034" });
      await tx.paymentOrder.update({ where: { id: current.id }, data: { status: "expired" } });
    });
  }
  if (stale.length > 0) orders = await dependencies.db.paymentOrder.findMany(query);
  const instructions = orders[0]?.method === "card_to_card" ? await cardInstructions(dependencies.db) : undefined;
  const currentOrder = orders[0];
  const activeAttempt = currentOrder?.attempts?.find((attempt: any) => attempt.id === currentOrder.activeAttemptId);
  const baleBotUrl = currentOrder?.method === "bale_wallet" && currentOrder.status === "pending" && activeAttempt?.method === "bale_wallet" && activeAttempt.status === "pending" && activeAttempt.balePayload
    ? `https://ble.ir/${dependencies.botUsername()}?start=${encodeURIComponent(activeAttempt.balePayload)}`
    : undefined;
  return NextResponse.json({ orders, baleBotUrl, paymentInstructions: instructions });
}
