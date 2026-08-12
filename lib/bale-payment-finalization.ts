import {
  isBaleAmountValid,
  isBaleCurrencyValid,
  isBalePayloadValid,
  effectiveBaleExpiry,
  isExpired,
} from "./bale-payment-domain";
import { runPaymentTransaction } from "./payment-transaction";
import {
  type BaleGroupEventTransaction,
  queueDuplicatePaymentEvent,
  queuePaidPaymentEvent,
} from "./bale-group-notifications";

type BaleTransaction = {
  paymentAttempt: {
    findUnique: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<{ count: number }>;
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

export type FinalizeBalePaymentInput = Omit<BaleSuccessfulPaymentInput, "baleTrackingNumber"> & {
  attemptId: string;
  baleTrackingNumber?: string;
  verificationSource?: "successful_payment" | "inquiry_paid";
};

function validIdentifiers(input: { balePaymentId: string; baleTrackingNumber?: string; verificationSource?: string }) {
  return Boolean(input.balePaymentId.trim() && (input.baleTrackingNumber?.trim() || input.verificationSource === "inquiry_paid"));
}

function validateSuccessfulPayment(attempt: any, input: BaleSuccessfulPaymentInput | FinalizeBalePaymentInput) {
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
}

function hasBaleGroupEventDelegate(tx: BaleTransaction): tx is BaleTransaction & BaleGroupEventTransaction {
  return "baleGroupEvent" in tx && typeof tx.baleGroupEvent === "object" && tx.baleGroupEvent !== null &&
    "upsert" in tx.baleGroupEvent && typeof tx.baleGroupEvent.upsert === "function";
}

async function resolveIdentifierOwnership(tx: BaleTransaction, attempt: any, input: BaleSuccessfulPaymentInput | FinalizeBalePaymentInput) {
  if (
    (attempt.balePaymentId && attempt.balePaymentId !== input.balePaymentId) ||
    (input.baleTrackingNumber && attempt.baleTrackingNumber && attempt.baleTrackingNumber !== input.baleTrackingNumber)
  ) {
    throw new Error("BALE_PAYMENT_IDENTIFIER_CONFLICT");
  }

  const owners = await tx.paymentAttempt.findMany({
    where: {
      OR: [
        { balePaymentId: input.balePaymentId },
        ...(input.baleTrackingNumber ? [{ baleTrackingNumber: input.baleTrackingNumber }] : []),
      ],
    },
    select: { id: true, status: true, balePaymentId: true, baleTrackingNumber: true },
  });
  const otherOwners = owners.filter((owner) => owner.id !== attempt.id);
  if (otherOwners.length === 0) return "owned" as const;
  const exactOwner = otherOwners.find((owner) => owner.balePaymentId === input.balePaymentId &&
    (!input.baleTrackingNumber || owner.baleTrackingNumber === input.baleTrackingNumber));
  if (exactOwner && ["paid", "paid_duplicate"].includes(exactOwner.status) && otherOwners.length === 1) return "already_paid" as const;
  throw new Error("BALE_PAYMENT_IDENTIFIER_CONFLICT");
}

export async function finalizeBalePayment(tx: BaleTransaction, input: FinalizeBalePaymentInput): Promise<BaleFinalizationResult> {
  const attempt = await tx.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    include: { order: { include: { user: { select: { name: true } }, course: { select: { title: true } }, application: { select: { fullName: true } } } } },
  });
  validateSuccessfulPayment(attempt, input);
  if (await resolveIdentifierOwnership(tx, attempt, input) === "already_paid") return "already_paid";

  const paidAt = input.paidAt || new Date();
  const samePayment =
    attempt.balePaymentId === input.balePaymentId &&
    (!input.baleTrackingNumber || attempt.baleTrackingNumber === input.baleTrackingNumber);

  if (attempt.order.status === "paid" && samePayment && ["paid", "paid_duplicate"].includes(attempt.status)) return "already_paid";

  if (attempt.order.status === "paid") {
    const duplicate = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, orderId: attempt.order.id },
      data: {
        balePaymentId: input.balePaymentId,
        ...(input.baleTrackingNumber ? { baleTrackingNumber: input.baleTrackingNumber } : {}),
        baleVerificationStatus: "successful_payment",
        status: "paid_duplicate",
        paidAt,
      },
    });
    if (duplicate.count !== 1) throw new Error("INVALID_BALE_PAYMENT");
    if (hasBaleGroupEventDelegate(tx)) await queueDuplicatePaymentEvent(tx, attempt.order, attempt.id, paidAt);
    return "paid_duplicate";
  }

  const paid = await tx.paymentAttempt.updateMany({
    where: { id: attempt.id, orderId: attempt.order.id },
    data: {
      balePaymentId: input.balePaymentId,
      ...(input.baleTrackingNumber ? { baleTrackingNumber: input.baleTrackingNumber } : {}),
      baleVerificationStatus: "successful_payment",
      status: "paid",
      paidAt,
      invalidatedAt: null,
    },
  });
  if (paid.count !== 1) throw new Error("INVALID_BALE_PAYMENT");

  if (attempt.order.activeAttemptId && attempt.order.activeAttemptId !== attempt.id) {
    await tx.paymentAttempt.updateMany({
      where: { id: attempt.order.activeAttemptId, orderId: attempt.order.id },
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
      ...(input.baleTrackingNumber ? { baleTransactionRef: input.baleTrackingNumber } : {}),
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
  if (hasBaleGroupEventDelegate(tx)) await queuePaidPaymentEvent(tx, attempt.order, paidAt);
  return "paid";
}

export async function processBaleSuccessfulPayment(db: BaleDatabase, input: BaleSuccessfulPaymentInput) {
  const attempt = await db.paymentAttempt.findUnique({
    where: { balePayload: input.invoicePayload },
    select: { id: true },
  });
  if (!attempt) return null;

  const storeEvidence = () => runPaymentTransaction(db, async (tx) => {
    const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id }, include: { order: true } });
    validateSuccessfulPayment(current, input);
    const ownership = await resolveIdentifierOwnership(tx, current, input);
    if (ownership === "already_paid") return ownership;
    const stored = await tx.paymentAttempt.updateMany({
      where: { id: current.id, orderId: current.order.id },
      data: {
        balePaymentId: input.balePaymentId,
        baleTrackingNumber: input.baleTrackingNumber,
        baleVerificationStatus: current.baleVerificationStatus === "successful_payment" ? "successful_payment" : "received",
      },
    });
    if (stored.count !== 1) throw new Error("INVALID_BALE_PAYMENT");
    return "stored" as const;
  });

  let evidence: "stored" | "already_paid";
  try {
    evidence = await storeEvidence();
  } catch (error) {
    if ((error as { code?: unknown })?.code !== "P2002") throw error;
    try {
      evidence = await storeEvidence();
    } catch (retryError) {
      if ((retryError as { code?: unknown })?.code === "P2002") throw new Error("BALE_PAYMENT_IDENTIFIER_CONFLICT");
      throw retryError;
    }
  }
  if (evidence === "already_paid") return evidence;
  return runPaymentTransaction(db, (tx) => finalizeBalePayment(tx, { ...input, attemptId: attempt.id }));
}

export async function processBalePreCheckout(
  db: BaleDatabase,
  input: { id: string; invoicePayload: string; currency: unknown; totalAmount: unknown; checkedAt?: Date },
) {
  try {
    return await runPaymentTransaction(db, async (tx) => {
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
        attempt.createdAt instanceof Date &&
        !isExpired(effectiveBaleExpiry(attempt.expiresAt, attempt.createdAt), checkedAt) &&
        (!attempt.balePaymentId || attempt.balePaymentId === input.id) &&
        input.id.trim()
      );
      if (!valid) return false;
      const owners = await tx.paymentAttempt.findMany({ where: { OR: [{ balePaymentId: input.id }] }, select: { id: true } });
      if (owners.some((owner: { id: string }) => owner.id !== attempt.id)) return false;
      const expiresAt = effectiveBaleExpiry(attempt.expiresAt, attempt.createdAt);
      const updated = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, orderId: attempt.order.id, OR: [{ balePaymentId: null }, { balePaymentId: input.id }] },
        data: { balePaymentId: input.id, balePreCheckoutAt: attempt.balePreCheckoutAt || checkedAt, expiresAt },
      });
      return updated.count === 1;
    });
  } catch (error) {
    if ((error as { code?: unknown })?.code === "P2002") return false;
    throw error;
  }
}
