export type PaymentOutcome = "pending" | "expired" | "paid";

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
  if (current === "expired" || incomingStatus === "expired") return "expired";
  return "pending";
}
