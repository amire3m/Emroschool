import assert from "node:assert/strict";
import test from "node:test";

import {
  BALE_PAYMENT_WINDOW_MS,
  effectiveBaleExpiry,
  isBaleAmountValid,
  isBaleCurrencyValid,
  isBalePaidStatus,
  isBalePayloadValid,
  isExpired,
  newBaleExpiry,
} from "../lib/bale-payment-domain";

test("creates a deadline exactly 15 minutes after the attempt", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  assert.equal(BALE_PAYMENT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(newBaleExpiry(now).toISOString(), "2026-08-10T12:15:00.000Z");
});

test("expires at the deadline boundary but not before it", () => {
  const expiresAt = new Date("2026-08-10T12:15:00.000Z");

  assert.equal(isExpired(expiresAt, new Date("2026-08-10T12:14:59.999Z")), false);
  assert.equal(isExpired(expiresAt, new Date("2026-08-10T12:15:00.000Z")), true);
});

test("derives a legacy deadline exactly 15 minutes from creation", () => {
  const createdAt = new Date("2026-08-10T12:00:00.000Z");

  assert.equal(effectiveBaleExpiry(null, createdAt).toISOString(), "2026-08-10T12:15:00.000Z");
  assert.equal(
    effectiveBaleExpiry(new Date("2026-08-10T12:20:00.000Z"), createdAt).toISOString(),
    "2026-08-10T12:20:00.000Z",
  );
});

test("accepts only the documented IRR currency", () => {
  assert.equal(isBaleCurrencyValid("IRR"), true);
  assert.equal(isBaleCurrencyValid("IRT"), false);
  assert.equal(isBaleCurrencyValid(undefined), false);
});

test("accepts only an exact positive integer amount", () => {
  assert.equal(isBaleAmountValid(4_000_000, 4_000_000), true);
  assert.equal(isBaleAmountValid(4_000_001, 4_000_000), false);
  assert.equal(isBaleAmountValid(0, 0), false);
  assert.equal(isBaleAmountValid(4_000_000.5, 4_000_000.5), false);
});

test("accepts only an exact non-empty attempt payload", () => {
  assert.equal(isBalePayloadValid("attempt-123", "attempt-123"), true);
  assert.equal(isBalePayloadValid("attempt-124", "attempt-123"), false);
  assert.equal(isBalePayloadValid("", ""), false);
});

test("recognizes only the documented paid transaction status", () => {
  assert.equal(isBalePaidStatus("paid"), true);
  assert.equal(isBalePaidStatus("success"), false);
  assert.equal(isBalePaidStatus(undefined), false);
});
