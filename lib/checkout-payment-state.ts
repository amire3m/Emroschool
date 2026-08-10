export type PaymentOutcome = "pending" | "expired" | "paid";
export type PaymentObservation = {
  outcome: PaymentOutcome;
  keepWatching: boolean;
};

export function newCheckoutApplicationState() {
  return {
    application: null,
    order: null,
    completionKind: null,
    expiredOrderId: null,
    botUrl: "",
    instructions: null,
    error: null,
    loading: false,
    applicationLoading: true,
    authTerminated: false,
  } as const;
}

export function isPendingBalePayment(
  order: { method: string; status: string } | null,
): order is { method: "bale_wallet"; status: "pending" } {
  return order?.method === "bale_wallet" && order.status === "pending";
}

export function getRemainingSeconds(
  expiresAt: string | null | undefined,
  now: number,
) {
  const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatPersianCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  const format = (value: number) =>
    value.toLocaleString("fa-IR", {
      minimumIntegerDigits: 2,
      useGrouping: false,
    });

  return `${format(minutes)}:${format(remainder)}`;
}

export function paymentOutcome(
  current: PaymentOutcome,
  incomingStatus: string,
): PaymentOutcome {
  if (current === "paid" || incomingStatus === "paid") return "paid";
  if (incomingStatus === "expired") return "expired";
  return "pending";
}

export function observePaymentStatus(
  current: PaymentObservation,
  incomingStatus: string,
): PaymentObservation {
  const outcome = paymentOutcome(current.outcome, incomingStatus);
  return { outcome, keepWatching: outcome !== "paid" };
}

export function getStatusRequestDelay(
  lastRequestAt: number | null,
  now: number,
  minimumSpacing = 4_000,
) {
  if (lastRequestAt === null) return 0;
  return Math.max(0, lastRequestAt + minimumSpacing - now);
}

export function shouldTerminateCheckoutRequest(status: number) {
  return status === 401;
}

export function canApplyCheckoutMutation(
  requestApplicationId: string | null,
  currentApplicationId: string | null,
  aborted: boolean,
) {
  return Boolean(
    requestApplicationId &&
      requestApplicationId === currentApplicationId &&
      !aborted,
  );
}
