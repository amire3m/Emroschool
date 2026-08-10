import {
  isBaleAmountValid,
  isBaleCurrencyValid,
  isBalePayloadValid,
  isExpired,
} from "./bale-payment-domain";

type BaleTransaction = {
  paymentAttempt: {
    findUnique: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
  paymentOrder: { update: (...args: any[]) => Promise<any> };
  courseApplication: { update: (...args: any[]) => Promise<any> };
  enrollment: { upsert: (...args: any[]) => Promise<any> };
};

type BaleDatabase = {
  paymentAttempt: { findUnique: (...args: any[]) => Promise<any> };
  $transaction: <T>(callback: (tx: BaleTransaction) => Promise<T>) => Promise<T>;
};

export type BaleFinalizationResult = "paid" | "already_paid" | "paid_duplicate";

export type BaleSuccessfulPaymentInput = {
  invoicePayload: string;
  currency: unknown;
  totalAmount: unknown;
  balePaymentId: string;
  baleTrackingNumber: string;
  paidAt?: Date;
  payerBaleId?: string;
  payerBaleName?: string;
};

export type FinalizeBalePaymentInput = BaleSuccessfulPaymentInput & { attemptId: string };

function validIdentifiers(input: BaleSuccessfulPaymentInput) {
  return Boolean(input.balePaymentId.trim() && input.baleTrackingNumber.trim());
}

export async function finalizeBalePayment(tx: BaleTransaction, input: FinalizeBalePaymentInput): Promise<BaleFinalizationResult> {
  const attempt = await tx.paymentAttempt.findUnique({ where: { id: input.attemptId }, include: { order: true } });
  if (
    !attempt ||
    attempt.method !== "bale_wallet" ||
    !isBalePayloadValid(input.invoicePayload, attempt.balePayload) ||
    !isBaleCurrencyValid(input.currency) ||
    !isBaleAmountValid(input.totalAmount, attempt.amountRials) ||
    !validIdentifiers(input)
  ) {
    throw new Error("INVALID_BALE_PAYMENT");
  }

  const paidAt = input.paidAt || new Date();
  const samePayment =
    attempt.balePaymentId === input.balePaymentId &&
    attempt.baleTrackingNumber === input.baleTrackingNumber;

  if (attempt.order.status === "paid" && samePayment && ["paid", "paid_duplicate"].includes(attempt.status)) return "already_paid";

  if (attempt.order.status === "paid") {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        balePaymentId: input.balePaymentId,
        baleTrackingNumber: input.baleTrackingNumber,
        baleVerificationStatus: "successful_payment",
        status: "paid_duplicate",
        paidAt,
      },
    });
    return "paid_duplicate";
  }

  await tx.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      balePaymentId: input.balePaymentId,
      baleTrackingNumber: input.baleTrackingNumber,
      baleVerificationStatus: "successful_payment",
      status: "paid",
      paidAt,
      invalidatedAt: null,
    },
  });

  if (attempt.order.activeAttemptId && attempt.order.activeAttemptId !== attempt.id) {
    await tx.paymentAttempt.update({
      where: { id: attempt.order.activeAttemptId },
      data: { status: "invalidated", invalidatedAt: paidAt },
    });
  }

  await tx.paymentOrder.update({
    where: { id: attempt.order.id },
    data: {
      status: "paid",
      method: "bale_wallet",
      paidAt,
      activeAttemptId: attempt.id,
      balePayload: attempt.balePayload,
      baleTransactionRef: input.baleTrackingNumber,
      ...(input.payerBaleId ? { payerBaleId: input.payerBaleId } : {}),
      ...(input.payerBaleName ? { payerBaleName: input.payerBaleName } : {}),
    },
  });
  if (attempt.order.applicationId) {
    await tx.courseApplication.update({ where: { id: attempt.order.applicationId }, data: { status: "approved" } });
  }
  await tx.enrollment.upsert({
    where: { userId_courseId: { userId: attempt.order.userId, courseId: attempt.order.courseId } },
    update: {},
    create: { userId: attempt.order.userId, courseId: attempt.order.courseId },
  });
  return "paid";
}

export async function processBaleSuccessfulPayment(db: BaleDatabase, input: BaleSuccessfulPaymentInput) {
  const attempt = await db.paymentAttempt.findUnique({
    where: { balePayload: input.invoicePayload },
    select: { id: true },
  });
  if (!attempt) return null;
  return db.$transaction((tx) => finalizeBalePayment(tx, { ...input, attemptId: attempt.id }));
}

export async function processBalePreCheckout(
  db: BaleDatabase,
  input: { id: string; invoicePayload: string; currency: unknown; totalAmount: unknown; checkedAt?: Date },
) {
  return db.$transaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findUnique({
      where: { balePayload: input.invoicePayload },
      include: { order: true },
    });
    const checkedAt = input.checkedAt || new Date();
    const valid = Boolean(
      attempt &&
      attempt.method === "bale_wallet" &&
      attempt.status === "pending" &&
      attempt.order.status !== "paid" &&
      attempt.order.activeAttemptId === attempt.id &&
      isBalePayloadValid(input.invoicePayload, attempt.balePayload) &&
      isBaleCurrencyValid(input.currency) &&
      isBaleAmountValid(input.totalAmount, attempt.amountRials) &&
      (!attempt.expiresAt || !isExpired(attempt.expiresAt, checkedAt)) &&
      input.id.trim()
    );
    if (!valid) return false;
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { balePaymentId: input.id, balePreCheckoutAt: checkedAt },
    });
    return true;
  });
}
