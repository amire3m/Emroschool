export const BALE_PAYMENT_WINDOW_MS = 15 * 60 * 1000;

export function newBaleExpiry(now: Date) {
  return new Date(now.getTime() + BALE_PAYMENT_WINDOW_MS);
}

export function effectiveBaleExpiry(expiresAt: Date | null | undefined, createdAt: Date) {
  return expiresAt instanceof Date ? expiresAt : newBaleExpiry(createdAt);
}

export function isExpired(expiresAt: Date, now: Date) {
  return now.getTime() >= expiresAt.getTime();
}

export function isBaleCurrencyValid(currency: unknown) {
  return currency === "IRR";
}

export function isBaleAmountValid(amount: unknown, expectedAmount: number) {
  return Number.isInteger(amount) && Number.isInteger(expectedAmount) && expectedAmount > 0 && amount === expectedAmount;
}

export function isBalePayloadValid(payload: unknown, expectedPayload: string) {
  return typeof payload === "string" && payload.length > 0 && payload === expectedPayload;
}

export function isBalePaidStatus(status: unknown) {
  return status === "paid";
}
