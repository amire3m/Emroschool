export const enrollmentGrantSources = {
  cardPayment: "payment_card",
  balePayment: "payment_bale",
  manualPayment: "payment_manual",
  freeCheckout: "free_checkout",
  adminEnrollment: "admin_enrollment",
  applicationApproval: "application_approval",
  legacy: "legacy",
} as const;

export type EnrollmentGrantSource = typeof enrollmentGrantSources[keyof typeof enrollmentGrantSources];

export async function ensureEnrollmentGrant(
  tx: any,
  input: { userId: string; courseId: string; sourceType: EnrollmentGrantSource; sourceId: string; now?: Date },
) {
  await tx.enrollment.upsert({
    where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    update: {},
    create: { userId: input.userId, courseId: input.courseId },
  });
  return tx.enrollmentGrant.upsert({
    where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
    update: { active: true, revokedAt: null },
    create: { userId: input.userId, courseId: input.courseId, sourceType: input.sourceType, sourceId: input.sourceId },
  });
}

export async function revokeEnrollmentGrant(
  tx: any,
  input: { sourceType: EnrollmentGrantSource; sourceId: string; now: Date },
) {
  return tx.enrollmentGrant.updateMany({
    where: { sourceType: input.sourceType, sourceId: input.sourceId, active: true },
    data: { active: false, revokedAt: input.now },
  });
}

export async function hasActiveEnrollmentGrant(tx: any, userId: string, courseId: string) {
  return (await tx.enrollmentGrant.count({ where: { userId, courseId, active: true } })) > 0;
}

export type PaymentReviewAction = "approve" | "reject" | "reopen_rejection" | "reverse_approval";

type Transition = { to: string; reason: boolean };
const transitions: Partial<Record<PaymentReviewAction, Transition>> = {
  approve: { to: "paid", reason: false },
  reject: { to: "rejected", reason: true },
  reopen_rejection: { to: "under_review", reason: true },
  reverse_approval: { to: "review_reopened", reason: true },
};
const approvalSourceStatuses = new Set(["under_review", "review_reopened"]);
const rejectionSourceStatuses = new Set(["under_review", "review_reopened"]);

export async function applyCardPaymentReview(tx: any, input: {
  order: any;
  reviewerId: string;
  action: PaymentReviewAction;
  reason: string;
  expectedReviewVersion: number;
  now: Date;
}) {
  const transition = transitions[input.action];
  if (!transition) throw new Error("INVALID_STATUS");
  const currentStatus = input.order.status;
  if (input.order.method !== "card_to_card") throw new Error("INVALID_STATUS");
  if (input.action === "approve" && !approvalSourceStatuses.has(currentStatus)) throw new Error("INVALID_STATUS");
  if (input.action === "reject" && !rejectionSourceStatuses.has(currentStatus)) throw new Error("INVALID_STATUS");
  if (input.action === "reopen_rejection" && currentStatus !== "rejected") throw new Error("INVALID_STATUS");
  if (input.action === "reverse_approval" && currentStatus !== "paid") throw new Error("INVALID_STATUS");
  if (transition.reason && !input.reason) throw new Error("REASON_REQUIRED");
  if (input.expectedReviewVersion !== input.order.reviewVersion) throw new Error("STALE_REVIEW_VERSION");

  const changed = await tx.paymentOrder.updateMany({
    where: { id: input.order.id, method: "card_to_card", status: currentStatus, reviewVersion: input.expectedReviewVersion },
    data: {
      status: transition.to,
      reviewVersion: { increment: 1 },
      rejectionReason: input.action === "reject" ? input.reason : null,
      reviewerId: input.reviewerId,
      reviewedAt: input.now,
      ...(input.action === "approve" && !input.order.paidAt ? { paidAt: input.now } : {}),
    },
  });
  if (changed.count !== 1) throw new Error("STALE_REVIEW_VERSION");

  if (input.order.activeAttemptId) {
    const attempt = await tx.paymentAttempt.updateMany({
      where: { id: input.order.activeAttemptId, orderId: input.order.id },
      data: { status: transition.to, rejectionReason: input.action === "reject" ? input.reason : null },
    });
    if (attempt.count !== 1) throw new Error("INVALID_ATTEMPT");
  }

  const decision = await tx.paymentReviewDecision.create({ data: {
    orderId: input.order.id,
    reviewerId: input.reviewerId,
    action: input.action,
    reason: input.reason || null,
    fromStatus: currentStatus,
    toStatus: transition.to,
    reviewVersion: input.expectedReviewVersion + 1,
    createdAt: input.now,
  } });

  if (input.action === "approve") {
    await ensureEnrollmentGrant(tx, { userId: input.order.userId, courseId: input.order.courseId, sourceType: enrollmentGrantSources.cardPayment, sourceId: input.order.id });
    if (input.order.applicationId) await tx.courseApplication.update({ where: { id: input.order.applicationId }, data: { status: "approved" } });
  } else if (input.action === "reverse_approval") {
    await revokeEnrollmentGrant(tx, { sourceType: enrollmentGrantSources.cardPayment, sourceId: input.order.id, now: input.now });
    if (input.order.applicationId) await tx.courseApplication.update({ where: { id: input.order.applicationId }, data: { status: "pending_payment" } });
  } else if (input.action === "reject" && input.order.applicationId) {
    await tx.courseApplication.update({ where: { id: input.order.applicationId }, data: { status: "pending_payment" } });
  }

  const updatedOrder = await tx.paymentOrder.findUniqueOrThrow({ where: { id: input.order.id } });
  return { order: updatedOrder, decision };
}
