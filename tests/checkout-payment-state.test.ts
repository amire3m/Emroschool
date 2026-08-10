import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPersianCountdown,
  getRemainingSeconds,
  isPendingBalePayment,
  paymentOutcome,
} from "../lib/checkout-payment-state";

test("derives remaining time from the absolute server deadline", () => {
  const deadline = "2026-08-10T12:15:00.000Z";

  assert.equal(getRemainingSeconds(deadline, Date.parse("2026-08-10T12:00:00.000Z")), 900);
  assert.equal(getRemainingSeconds(deadline, Date.parse("2026-08-10T12:14:59.001Z")), 1);
  assert.equal(getRemainingSeconds(deadline, Date.parse("2026-08-10T12:15:00.000Z")), 0);
  assert.equal(getRemainingSeconds(deadline, Date.parse("2026-08-10T12:16:00.000Z")), 0);
});

test("treats malformed deadlines as elapsed rather than extending payment", () => {
  assert.equal(getRemainingSeconds(null, Date.now()), 0);
  assert.equal(getRemainingSeconds("not-a-date", Date.now()), 0);
});

test("renders a zero-padded Persian minute and second countdown", () => {
  assert.equal(formatPersianCountdown(900), "۱۵:۰۰");
  assert.equal(formatPersianCountdown(61), "۰۱:۰۱");
  assert.equal(formatPersianCountdown(0), "۰۰:۰۰");
});

test("paid status always wins over an expired response", () => {
  assert.equal(paymentOutcome("expired", "paid"), "paid");
  assert.equal(paymentOutcome("paid", "expired"), "paid");
  assert.equal(paymentOutcome("pending", "expired"), "expired");
  assert.equal(paymentOutcome("pending", "pending"), "pending");
});

test("polls only a pending Bale payment", () => {
  assert.equal(isPendingBalePayment({ method: "bale_wallet", status: "pending" }), true);
  assert.equal(isPendingBalePayment({ method: "bale_wallet", status: "paid" }), false);
  assert.equal(isPendingBalePayment({ method: "bale_wallet", status: "expired" }), false);
  assert.equal(isPendingBalePayment({ method: "card_to_card", status: "pending" }), false);
  assert.equal(isPendingBalePayment(null), false);
});
