export type BaleReconciliationAttempt = {
  id: string;
  sequence: number;
  method: string;
  status: string;
  amountRials?: number;
  balePayload?: string | null;
  balePaymentId?: string | null;
  baleTrackingNumber?: string | null;
};

type BaleReconciliationOrder<T extends BaleReconciliationAttempt> = {
  activeAttemptId?: string | null;
  attempts?: T[] | null;
};

export function isUnresolvedBaleAttempt(attempt: BaleReconciliationAttempt) {
  return attempt.method === "bale_wallet" && !["paid", "paid_duplicate"].includes(attempt.status);
}

export function selectBaleReconciliationAttempt<T extends BaleReconciliationAttempt>(
  order: BaleReconciliationOrder<T>,
  requestedAttemptId?: string | null,
) {
  const attempts = (order.attempts || [])
    .filter((attempt) => attempt.method === "bale_wallet")
    .slice()
    .sort((left, right) => right.sequence - left.sequence || right.id.localeCompare(left.id));
  const active = attempts.find((attempt) => attempt.id === order.activeAttemptId);
  if (requestedAttemptId) {
    const requested = attempts.find((attempt) => attempt.id === requestedAttemptId);
    return requested && isUnresolvedBaleAttempt(requested) ? requested : null;
  }
  const evidence = attempts.find((attempt) =>
    isUnresolvedBaleAttempt(attempt) && Boolean(attempt.balePaymentId || attempt.baleTrackingNumber),
  );
  if (evidence) return evidence;
  if (active && isUnresolvedBaleAttempt(active)) return active;
  return attempts[0] || null;
}

export function isBaleReconciliationEligible(order: BaleReconciliationOrder<BaleReconciliationAttempt> & {
  method: string;
  status: string;
}) {
  if (order.status === "paid") return false;
  const attempt = selectBaleReconciliationAttempt(order);
  return attempt ? isUnresolvedBaleAttempt(attempt) : order.method === "bale_wallet";
}
