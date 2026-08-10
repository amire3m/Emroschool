import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getIranianCardInfo } from "@/lib/iranian-card";
import { encryptPaymentCard } from "@/lib/payment-card-crypto";
import { effectiveBaleExpiry, isExpired, newBaleExpiry } from "@/lib/bale-payment-domain";
import { runPaymentTransaction } from "@/lib/payment-transaction";

type PaymentRouteDependencies = { db: any; now: () => Date; onError: (error: unknown) => void; botUsername: () => string };

const defaultDependencies: PaymentRouteDependencies = {
  db: prisma,
  now: () => new Date(),
  onError: (error) => console.error("Payment creation error:", error),
  botUsername: () => process.env.BALE_BOT_USERNAME || "imamruhollahschool_bot",
};

const checkoutAttemptSelect = {
  id: true,
  sequence: true,
  method: true,
  status: true,
  createdAt: true,
  expiresAt: true,
};

const checkoutOrderSelect = {
  id: true,
  orderNumber: true,
  amountTomans: true,
  method: true,
  status: true,
  rejectionReason: true,
  receiptUrl: true,
  expiresAt: true,
  activeAttemptId: true,
  createdAt: true,
  course: { select: { id: true, title: true, slug: true, thumbnail: true } },
  application: { select: { id: true, status: true, finalAmountTomans: true } },
  attempts: { orderBy: { sequence: "desc" as const }, select: checkoutAttemptSelect },
};

function safeCheckoutAttempt(attempt: any) {
  const { id, sequence, method, status, createdAt, expiresAt } = attempt;
  return { id, sequence, method, status, createdAt, expiresAt };
}

function safeCheckoutOrder(order: any) {
  const {
    id,
    orderNumber,
    amountTomans,
    method,
    status,
    rejectionReason,
    receiptUrl,
    expiresAt,
    createdAt,
    course,
    application,
  } = order;
  return {
    id,
    orderNumber,
    amountTomans,
    method,
    status,
    rejectionReason,
    receiptUrl,
    expiresAt,
    createdAt,
    course,
    application,
    attempts: (order.attempts || []).map(safeCheckoutAttempt),
  };
}

async function checkoutOrderResponse(db: any, where: Record<string, unknown>, botUsername: string) {
  const order = await db.paymentOrder.findFirst({ where, select: checkoutOrderSelect });
  if (!order) return null;
  const activeAttempt = order.attempts.find((attempt: any) => attempt.id === order.activeAttemptId);
  const activePayload = order.method === "bale_wallet" && order.status === "pending" && activeAttempt?.method === "bale_wallet" && activeAttempt.status === "pending"
    ? await db.paymentAttempt.findFirst({ where: { id: activeAttempt.id, orderId: order.id }, select: { balePayload: true } })
    : null;
  return {
    order: safeCheckoutOrder(order),
    baleBotUrl: activePayload?.balePayload
      ? `https://ble.ir/${botUsername}?start=${encodeURIComponent(activePayload.balePayload)}`
      : undefined,
  };
}

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
  let requestedApplicationId = "";
  try {
    const { applicationId, method, payerCardNumber } = await req.json();
    requestedApplicationId = typeof applicationId === "string" ? applicationId : "";
    if (!applicationId) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const application = await dependencies.db.courseApplication.findUnique({ where: { id: applicationId }, include: { course: true, paymentOrder: true } });
    if (!application || application.userId !== id) return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    if (!["pending", "pending_payment"].includes(application.status) || !application.course.published || application.course.scheduleStatus !== "upcoming") return NextResponse.json({ error: "این درخواست قابل پرداخت نیست" }, { status: 400 });
    const discount = application.discountCode ? await dependencies.db.discountCode.findUnique({ where: { code: application.discountCode } }) : null;
    if (discount?.requiresDocument && !application.discountDocumentUrl) return NextResponse.json({ error: "بارگذاری مدرک تخفیف الزامی است" }, { status: 400 });
    if (application.paymentOrder) {
      const existing = await checkoutOrderResponse(dependencies.db, { id: application.paymentOrder.id, userId: id }, dependencies.botUsername());
      if (!existing) throw new Error("PAYMENT_ORDER_MISSING");
      return NextResponse.json({
        ...existing,
        paymentInstructions: existing.order.method === "card_to_card" ? await cardInstructions(dependencies.db) : undefined,
        existing: true,
      });
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
    const createdResponse = await checkoutOrderResponse(dependencies.db, { id: order.id, userId: id }, dependencies.botUsername());
    if (!createdResponse) throw new Error("PAYMENT_ORDER_MISSING");
    return NextResponse.json({
      ...createdResponse,
      paymentInstructions: method === "card_to_card" ? await cardInstructions(dependencies.db) : undefined,
    }, { status: 201 });
  } catch (error) {
    if ((error as { code?: unknown })?.code === "P2002" && requestedApplicationId) {
      const winner = await checkoutOrderResponse(
        dependencies.db,
        { applicationId: requestedApplicationId, userId: id },
        dependencies.botUsername(),
      );
      if (winner) {
        return NextResponse.json({
          ...winner,
          existing: true,
          paymentInstructions: winner.order.method === "card_to_card" ? await cardInstructions(dependencies.db) : undefined,
        });
      }
    }
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
  const query = {
    where: { userId: id, ...(applicationId ? { applicationId } : {}) },
    select: checkoutOrderSelect,
    orderBy: { createdAt: "desc" as const },
  };
  let orders = await dependencies.db.paymentOrder.findMany(query);
  const now = dependencies.now();
  const legacyOrStale = orders.filter((order: any) => {
    if (order.method !== "bale_wallet" || order.status !== "pending") return false;
    const attempt = order.attempts.find((item: any) => item.id === order.activeAttemptId);
    return attempt?.createdAt instanceof Date &&
      (!(order.expiresAt instanceof Date) || !(attempt.expiresAt instanceof Date) || isExpired(effectiveBaleExpiry(attempt.expiresAt, attempt.createdAt), now));
  });
  for (const order of legacyOrStale) {
    await runPaymentTransaction(dependencies.db, async (tx) => {
      const current = await tx.paymentOrder.findFirst({ where: { id: order.id, userId: id } });
      if (!current || current.status === "paid" || current.method !== "bale_wallet" || current.status !== "pending") return;
      const attempt = current.activeAttemptId ? await tx.paymentAttempt.findFirst({ where: { id: current.activeAttemptId, orderId: current.id } }) : null;
      if (!attempt || attempt.status === "paid" || attempt.method !== "bale_wallet" || attempt.status !== "pending" || !(attempt.createdAt instanceof Date)) return;
      const expiresAt = effectiveBaleExpiry(attempt.expiresAt, attempt.createdAt);
      const expired = isExpired(expiresAt, now);
      const updated = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, orderId: current.id },
        data: { expiresAt, ...(expired ? { status: "expired", invalidatedAt: now } : {}) },
      });
      if (updated.count !== 1) throw Object.assign(new Error("Active attempt changed"), { code: "P2034" });
      await tx.paymentOrder.update({ where: { id: current.id }, data: { expiresAt, ...(expired ? { status: "expired" } : {}) } });
    });
  }
  if (legacyOrStale.length > 0) orders = await dependencies.db.paymentOrder.findMany(query);
  const currentOrder = orders[0];
  const activeAttempt = currentOrder?.attempts?.find((attempt: any) => attempt.id === currentOrder.activeAttemptId);
  const activePayload = currentOrder?.method === "bale_wallet" && currentOrder.status === "pending" && activeAttempt?.method === "bale_wallet" && activeAttempt.status === "pending"
    ? await dependencies.db.paymentAttempt.findFirst({ where: { id: activeAttempt.id, orderId: currentOrder.id }, select: { balePayload: true } })
    : null;
  const baleBotUrl = activePayload?.balePayload
    ? `https://ble.ir/${dependencies.botUsername()}?start=${encodeURIComponent(activePayload.balePayload)}`
    : undefined;
  const instructions = currentOrder?.method === "card_to_card" ? await cardInstructions(dependencies.db) : undefined;
  return NextResponse.json({ orders: orders.map(safeCheckoutOrder), baleBotUrl, paymentInstructions: instructions });
}
