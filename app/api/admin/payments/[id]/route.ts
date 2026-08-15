import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { queuePaidPaymentEvent, queuePaymentReviewDecisionEvent } from "@/lib/bale-group-notifications";
import { applyCardPaymentReview, type PaymentReviewAction } from "@/lib/payment-review";

async function admin(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !isAdminRole(user.role)) return null;
  if (user.role !== "superadmin" && user.permissions) {
    try { const permissions = JSON.parse(user.permissions); if (permissions.length && !permissions.includes("payments") && !permissions.includes("support")) return null; } catch { return null; }
  }
  return user;
}

const defaultDependencies = { db: prisma, authorize: admin, now: () => new Date() };

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
  overrides: Partial<typeof defaultDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const reviewer = await dependencies.authorize(req);
  if (!reviewer) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
     const { action, rejectionReason, reason: suppliedReason, expectedReviewVersion } = await req.json();
    if (!['approve', 'reject', 'reopen_rejection', 'reverse_approval'].includes(action)) return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
    if (!Number.isInteger(expectedReviewVersion) || expectedReviewVersion < 0) return NextResponse.json({ error: "نسخه بررسی نامعتبر است" }, { status: 400 });
    const result = await dependencies.db.$transaction(async (tx) => {
       const order = await tx.paymentOrder.findUnique({ where: { id: params.id }, include: { user: { select: { name: true } }, course: { select: { title: true } }, application: { select: { fullName: true } } } });
      if (!order) return null;
       const reason = typeof suppliedReason === "string" ? suppliedReason.trim() : typeof rejectionReason === "string" ? rejectionReason.trim() : "";
       const reviewedAt = dependencies.now();
       const { decision, order: updatedOrder } = await applyCardPaymentReview(tx, { order, reviewerId: reviewer.id, action: action as PaymentReviewAction, reason, expectedReviewVersion, now: reviewedAt });
       if (action === "approve") {
           await queuePaidPaymentEvent(tx, order, reviewedAt);
       } else {
           await queuePaymentReviewDecisionEvent(tx, decision, order, { id: reviewer.id, name: reviewer.name ?? reviewer.id }, reviewedAt);
       }
       return updatedOrder;
    });
    if (!result) return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    return NextResponse.json({ order: result });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATUS") return NextResponse.json({ error: "این سفارش قابل بررسی نیست" }, { status: 409 });
    if (error instanceof Error && error.message === "STALE_REVIEW_VERSION") return NextResponse.json({ error: "این بررسی هم‌زمان تغییر کرده است" }, { status: 409 });
    if (error instanceof Error && error.message === "REASON_REQUIRED") return NextResponse.json({ error: "دلیل رد پرداخت الزامی است" }, { status: 400 });
    console.error("Payment review error:", error);
    return NextResponse.json({ error: "بررسی پرداخت انجام نشد" }, { status: 500 });
  }
}
