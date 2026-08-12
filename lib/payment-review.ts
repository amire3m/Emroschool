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

const transitions: Record<PaymentReviewAction, { from: string; to: string; reason: boolean }> = {
  approve: { from: "under_review", to: "paid", reason: false },
  reject: { from: "under_review", to: "rejected", reason: true },
  reopen_rejection: { from: "rejected", to: "under_review", reason: true },
  reverse_approval: { from: "paid", to: "under_review", reason: true },
};

export async function applyCardPaymentReview(tx: any, input: {
  order: any;
  reviewerId: string;
  action: PaymentReviewAction;
  reason: string;
  expectedReviewVersion: number;
  now: Date;
}) {
  const transition = transitions[input.action];
  if (input.order.method !== "card_to_card" || input.order.status !== transition.from) throw new Error("INVALID_STATUS");
  if (transition.reason && !input.reason) throw new Error("REASON_REQUIRED");
  if (input.expectedReviewVersion !== input.order.reviewVersion) throw new Error("STALE_REVIEW_VERSION");

  const changed = await tx.paymentOrder.updateMany({
    where: { id: input.order.id, method: "card_to_card", status: transition.from, reviewVersion: input.expectedReviewVersion },
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

  await tx.paymentReviewDecision.create({ data: {
    orderId: input.order.id,
    reviewerId: input.reviewerId,
    action: input.action,
    reason: input.reason || null,
    fromStatus: transition.from,
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

  return tx.paymentOrder.findUniqueOrThrow({ where: { id: input.order.id } });
}
