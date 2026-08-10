import assert from "node:assert/strict";
import test from "node:test";

import {
  canApplyCheckoutMutation,
  checkoutMutationCompletion,
  formatPersianCountdown,
  getRemainingSeconds,
  getStatusRequestDelay,
  isPendingBalePayment,
  newCheckoutApplicationState,
  observePaymentStatus,
  paymentOutcome,
  shouldTerminateCheckoutRequest,
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
  assert.equal(paymentOutcome("expired", "pending"), "pending");
  assert.equal(paymentOutcome("pending", "pending"), "pending");
});

test("polls only a pending Bale payment", () => {
  assert.equal(isPendingBalePayment({ method: "bale_wallet", status: "pending" }), true);
  assert.equal(isPendingBalePayment({ method: "bale_wallet", status: "paid" }), false);
  assert.equal(isPendingBalePayment({ method: "bale_wallet", status: "expired" }), false);
  assert.equal(isPendingBalePayment({ method: "card_to_card", status: "pending" }), false);
  assert.equal(isPendingBalePayment(null), false);
});

test("keeps observing an expired order and accepts a later paid status", () => {
  const expired = observePaymentStatus(
    { outcome: "pending", keepWatching: true },
    "expired",
  );
  const paid = observePaymentStatus(expired, "paid");

  assert.deepEqual(expired, { outcome: "expired", keepWatching: true });
  assert.deepEqual(paid, { outcome: "paid", keepWatching: false });
});

test("spaces status requests by at least four seconds across resume events", () => {
  assert.equal(getStatusRequestDelay(null, 10_000), 0);
  assert.equal(getStatusRequestDelay(10_000, 10_000), 4_000);
  assert.equal(getStatusRequestDelay(10_000, 12_500), 1_500);
  assert.equal(getStatusRequestDelay(10_000, 14_000), 0);
  assert.equal(getStatusRequestDelay(10_000, 15_000), 0);
});

test("resets all application-scoped checkout state before loading another application", () => {
  assert.deepEqual(newCheckoutApplicationState(), {
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
  });
});

test("terminates checkout request loops only on unauthorized responses", () => {
  assert.equal(shouldTerminateCheckoutRequest(401), true);
  assert.equal(shouldTerminateCheckoutRequest(409), false);
  assert.equal(shouldTerminateCheckoutRequest(500), false);
});

test("suppresses stale or aborted checkout mutation responses", () => {
  assert.equal(canApplyCheckoutMutation("application-a", "application-a", false), true);
  assert.equal(canApplyCheckoutMutation("application-a", "application-b", false), false);
  assert.equal(canApplyCheckoutMutation("application-a", "application-a", true), false);
  assert.equal(canApplyCheckoutMutation(null, null, false), false);
});

test("current mutation owner releases ownership and clears loading on completion", () => {
  assert.deepEqual(
    checkoutMutationCompletion(true, "application-a", "application-a", false),
    { releaseOwner: true, clearLoading: true },
  );
});

test("stale mutation completion cannot release or clear a newer owner", () => {
  assert.deepEqual(
    checkoutMutationCompletion(false, "application-a", "application-a", false),
    { releaseOwner: false, clearLoading: false },
  );
});

test("application transition or abort releases only the current stale owner", () => {
  assert.deepEqual(
    checkoutMutationCompletion(true, "application-a", "application-b", false),
    { releaseOwner: true, clearLoading: false },
  );
  assert.deepEqual(
    checkoutMutationCompletion(true, "application-a", "application-a", true),
    { releaseOwner: true, clearLoading: false },
  );
});
