import assert from "node:assert/strict";
import test from "node:test";

import {
  finalizeBalePayment,
  processBalePreCheckout,
  processBaleSuccessfulPayment,
} from "../lib/bale-payment-finalization";
import { sendMessage } from "../lib/bale-payment";

type Attempt = {
  id: string;
  orderId: string;
  method: string;
  status: string;
  amountRials: number;
  balePayload: string;
  balePaymentId: string | null;
  baleTrackingNumber: string | null;
  baleVerificationStatus: string;
  balePreCheckoutAt: Date | null;
  paidAt: Date | null;
  invalidatedAt: Date | null;
};

type Order = {
  id: string;
  status: string;
  method: string;
  amountRials: number;
  balePayload: string | null;
  baleTransactionRef: string | null;
  activeAttemptId: string | null;
  paidAt: Date | null;
  payerBaleId?: string;
  payerBaleName?: string;
  userId: string;
  courseId: string;
  applicationId: string | null;
};

function fixture() {
  const attempts: Attempt[] = [
    {
      id: "attempt-old",
      orderId: "order-1",
      method: "bale_wallet",
      status: "invalidated",
      amountRials: 4_000_000,
      balePayload: "payload-old",
      balePaymentId: null,
      baleTrackingNumber: null,
      baleVerificationStatus: "unverified",
      balePreCheckoutAt: null,
      paidAt: null,
      invalidatedAt: new Date("2026-08-10T11:55:00.000Z"),
    },
    {
      id: "attempt-active",
      orderId: "order-1",
      method: "bale_wallet",
      status: "pending",
      amountRials: 4_000_000,
      balePayload: "payload-active",
      balePaymentId: null,
      baleTrackingNumber: null,
      baleVerificationStatus: "unverified",
      balePreCheckoutAt: null,
      paidAt: null,
      invalidatedAt: null,
    },
  ];
  const order: Order = {
    id: "order-1",
    status: "pending",
    method: "bale_wallet",
    amountRials: 4_000_000,
    balePayload: "payload-active",
    baleTransactionRef: null,
    activeAttemptId: "attempt-active",
    paidAt: null,
    userId: "user-1",
    courseId: "course-1",
    applicationId: "application-1",
  };
  let applicationStatus = "pending_payment";
  const enrollments = new Set<string>();

  const tx = {
    paymentAttempt: {
      findUnique: async ({ where }: { where: { id?: string; balePayload?: string } }) => {
        const attempt = attempts.find((item) => item.id === where.id || item.balePayload === where.balePayload);
        return attempt ? { ...attempt, order: { ...order } } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Attempt> }) => {
        const attempt = attempts.find((item) => item.id === where.id);
        assert.ok(attempt);
        Object.assign(attempt, data);
        return { ...attempt };
      },
    },
    paymentOrder: {
      update: async ({ where, data }: { where: { id: string }; data: Partial<Order> }) => {
        assert.equal(where.id, order.id);
        Object.assign(order, data);
        return { ...order };
      },
    },
    courseApplication: {
      update: async ({ data }: { data: { status: string } }) => {
        applicationStatus = data.status;
      },
    },
    enrollment: {
      upsert: async ({ where }: { where: { userId_courseId: { userId: string; courseId: string } } }) => {
        enrollments.add(`${where.userId_courseId.userId}:${where.userId_courseId.courseId}`);
      },
    },
  };
  const db = {
    paymentAttempt: tx.paymentAttempt,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return {
    attempts,
    order,
    tx,
    db,
    enrollments,
    applicationStatus: () => applicationStatus,
  };
}

const successfulPayment = {
  invoicePayload: "payload-active",
  currency: "IRR",
  totalAmount: 4_000_000,
  balePaymentId: "payment-123",
  baleTrackingNumber: "tracking-456",
  paidAt: new Date("2026-08-10T12:00:00.000Z"),
  payerBaleId: "42",
  payerBaleName: "Bale User",
};

test("finalizes a documented successful payment without provider inquiry", async () => {
  const state = fixture();

  const result = await processBaleSuccessfulPayment(state.db, successfulPayment);

  assert.equal(result, "paid");
  assert.equal(state.order.status, "paid");
  assert.equal(state.order.baleTransactionRef, "tracking-456");
  assert.equal(state.attempts[1].status, "paid");
  assert.equal(state.attempts[1].balePaymentId, "payment-123");
  assert.equal(state.attempts[1].baleTrackingNumber, "tracking-456");
  assert.equal(state.attempts[1].baleVerificationStatus, "successful_payment");
  assert.equal(state.applicationStatus(), "approved");
  assert.deepEqual([...state.enrollments], ["user-1:course-1"]);
});

test("treats a repeated webhook for the same payment as idempotent", async () => {
  const state = fixture();

  assert.equal(await processBaleSuccessfulPayment(state.db, successfulPayment), "paid");
  assert.equal(await processBaleSuccessfulPayment(state.db, successfulPayment), "already_paid");
  assert.equal(state.order.activeAttemptId, "attempt-active");
  assert.deepEqual([...state.enrollments], ["user-1:course-1"]);
});

test("finalizes an unpaid order from an old attempt payload", async () => {
  const state = fixture();

  const result = await processBaleSuccessfulPayment(state.db, {
    ...successfulPayment,
    invoicePayload: "payload-old",
  });

  assert.equal(result, "paid");
  assert.equal(state.attempts[0].status, "paid");
  assert.equal(state.attempts[0].invalidatedAt, null);
  assert.equal(state.attempts[1].status, "invalidated");
  assert.equal(state.order.activeAttemptId, "attempt-old");
  assert.equal(state.order.balePayload, "payload-old");
});

test("records a distinct payment on an already-paid order as a duplicate", async () => {
  const state = fixture();
  assert.equal(await processBaleSuccessfulPayment(state.db, successfulPayment), "paid");

  const duplicate = await processBaleSuccessfulPayment(state.db, {
    ...successfulPayment,
    invoicePayload: "payload-old",
    balePaymentId: "payment-duplicate",
    baleTrackingNumber: "tracking-duplicate",
  });

  assert.equal(duplicate, "paid_duplicate");
  assert.equal(state.attempts[0].status, "paid_duplicate");
  assert.equal(state.attempts[0].balePaymentId, "payment-duplicate");
  assert.equal(state.order.activeAttemptId, "attempt-active");
  assert.equal(state.order.baleTransactionRef, "tracking-456");
  assert.equal(
    await processBaleSuccessfulPayment(state.db, {
      ...successfulPayment,
      invoicePayload: "payload-old",
      balePaymentId: "payment-duplicate",
      baleTrackingNumber: "tracking-duplicate",
    }),
    "already_paid",
  );
});

test("rejects a successful payment with the wrong amount without storing identifiers", async () => {
  const state = fixture();

  await assert.rejects(
    finalizeBalePayment(state.tx, { ...successfulPayment, attemptId: "attempt-active", totalAmount: 3_999_999 }),
    /INVALID_BALE_PAYMENT/,
  );

  assert.equal(state.attempts[1].balePaymentId, null);
  assert.equal(state.order.status, "pending");
});

test("rejects a successful payment with the wrong currency without storing identifiers", async () => {
  const state = fixture();

  await assert.rejects(
    finalizeBalePayment(state.tx, { ...successfulPayment, attemptId: "attempt-active", currency: "IRT" }),
    /INVALID_BALE_PAYMENT/,
  );

  assert.equal(state.attempts[1].baleTrackingNumber, null);
  assert.equal(state.order.status, "pending");
});

test("stores the pre-checkout payment ID before accepting an active attempt", async () => {
  const state = fixture();
  const checkedAt = new Date("2026-08-10T11:59:00.000Z");

  const accepted = await processBalePreCheckout(state.db, {
    id: "payment-123",
    invoicePayload: "payload-active",
    currency: "IRR",
    totalAmount: 4_000_000,
    checkedAt,
  });

  assert.equal(accepted, true);
  assert.equal(state.attempts[1].balePaymentId, "payment-123");
  assert.equal(state.attempts[1].balePreCheckoutAt, checkedAt);
});

test("uses a Bale HTTP timeout below ten seconds", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.BALE_BOT_TOKEN;
  let requestSignal: AbortSignal | undefined;
  let timeoutMs: number | undefined;
  const originalTimeout = AbortSignal.timeout;
  process.env.BALE_BOT_TOKEN = "bot-token";
  AbortSignal.timeout = ((milliseconds: number) => {
    timeoutMs = milliseconds;
    return originalTimeout(milliseconds);
  }) as typeof AbortSignal.timeout;
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestSignal = init?.signal || undefined;
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await sendMessage("chat-1", "hello");
    assert.ok(requestSignal);
    assert.ok(timeoutMs && timeoutMs > 0 && timeoutMs < 10_000);
  } finally {
    global.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
    if (originalToken === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = originalToken;
  }
});

test("preserves safe Bale provider error details without exposing tokens", async () => {
  const originalFetch = global.fetch;
  const originalBotToken = process.env.BALE_BOT_TOKEN;
  const originalWalletToken = process.env.BALE_WALLET_TOKEN;
  process.env.BALE_BOT_TOKEN = "secret-bot-token";
  process.env.BALE_WALLET_TOKEN = "secret-wallet-token";
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error_code: 400,
        description: "bad request for secret-bot-token and secret-wallet-token",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    await assert.rejects(sendMessage("chat-1", "hello"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /400/);
      assert.match(error.message, /bad request/);
      assert.doesNotMatch(error.message, /secret-bot-token|secret-wallet-token/);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
    if (originalBotToken === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = originalBotToken;
    if (originalWalletToken === undefined) delete process.env.BALE_WALLET_TOKEN;
    else process.env.BALE_WALLET_TOKEN = originalWalletToken;
  }
});
