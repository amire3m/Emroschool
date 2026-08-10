import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import {
  finalizeBalePayment,
  processBalePreCheckout,
  processBaleSuccessfulPayment,
} from "../lib/bale-payment-finalization";
import { sendMessage } from "../lib/bale-payment";
import { POST as handleBaleWebhook } from "../app/api/bale/webhook/[secret]/route";

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
  expiresAt: Date | null;
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
      expiresAt: new Date("2026-08-10T12:15:00.000Z"),
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
      expiresAt: new Date("2026-08-10T12:15:00.000Z"),
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
  const transactionFailures: Array<Error | null> = [];
  const identifierWriteFailures: Error[] = [];

  const createTx = (attemptState: Attempt[], orderState: Order, application: { status: string }, enrollmentState: Set<string>) => ({
    paymentAttempt: {
      findUnique: async ({ where }: { where: { id?: string; balePayload?: string } }) => {
        const attempt = attemptState.find((item) => item.id === where.id || item.balePayload === where.balePayload);
        return attempt ? { ...attempt, order: { ...orderState } } : null;
      },
      findMany: async ({ where }: { where: { OR: Array<{ balePaymentId?: string; baleTrackingNumber?: string }> } }) => {
        return attemptState.filter((attempt) => where.OR.some((condition) =>
          (condition.balePaymentId && attempt.balePaymentId === condition.balePaymentId) ||
          (condition.baleTrackingNumber && attempt.baleTrackingNumber === condition.baleTrackingNumber),
        )).map((attempt) => ({ ...attempt }));
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Attempt> }) => {
        const attempt = attemptState.find((item) => item.id === where.id);
        assert.ok(attempt);
        if ((data.balePaymentId || data.baleTrackingNumber) && identifierWriteFailures.length > 0) throw identifierWriteFailures.shift();
        for (const key of ["balePaymentId", "baleTrackingNumber"] as const) {
          if (data[key] && attemptState.some((item) => item.id !== attempt.id && item[key] === data[key])) {
            throw Object.assign(new Error(`Unique constraint failed on ${key}`), { code: "P2002" });
          }
        }
        Object.assign(attempt, data);
        return { ...attempt };
      },
    },
    paymentOrder: {
      update: async ({ where, data }: { where: { id: string }; data: Partial<Order> }) => {
        assert.equal(where.id, orderState.id);
        Object.assign(orderState, data);
        return { ...orderState };
      },
    },
    courseApplication: {
      update: async ({ data }: { data: { status: string } }) => {
        application.status = data.status;
      },
    },
    enrollment: {
      upsert: async ({ where }: { where: { userId_courseId: { userId: string; courseId: string } } }) => {
        enrollmentState.add(`${where.userId_courseId.userId}:${where.userId_courseId.courseId}`);
      },
    },
  });
  const application = { status: applicationStatus };
  const tx = createTx(attempts, order, application, enrollments);
  const db = {
    paymentAttempt: {
      ...tx.paymentAttempt,
      update: tx.paymentAttempt.update,
    },
    paymentOrder: tx.paymentOrder,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      const attemptCopy = attempts.map((attempt) => ({ ...attempt }));
      const orderCopy = { ...order };
      const applicationCopy = { status: application.status };
      const enrollmentsCopy = new Set(enrollments);
      const result = await callback(createTx(attemptCopy, orderCopy, applicationCopy, enrollmentsCopy));
      const failure = transactionFailures.shift();
      if (failure) throw failure;
      attempts.splice(0, attempts.length, ...attemptCopy);
      Object.assign(order, orderCopy);
      application.status = applicationCopy.status;
      enrollments.clear();
      for (const enrollment of enrollmentsCopy) enrollments.add(enrollment);
      return result;
    },
  };

  return {
    attempts,
    order,
    tx,
    db,
    enrollments,
    failTransactions: (...failures: Array<Error | null>) => transactionFailures.push(...failures),
    failIdentifierWrites: (...failures: Error[]) => identifierWriteFailures.push(...failures),
    applicationStatus: () => application.status,
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

test("finalizes wallet payment when successful-payment ID equals the pre-checkout ID", async () => {
  const state = fixture();

  assert.equal(await processBalePreCheckout(state.db, {
    id: "payment-123",
    invoicePayload: "payload-active",
    currency: "IRR",
    totalAmount: 4_000_000,
    checkedAt: new Date("2026-08-10T11:59:00.000Z"),
  }), true);

  assert.equal(await processBaleSuccessfulPayment(state.db, successfulPayment), "paid");
  assert.equal(state.attempts[1].balePaymentId, "payment-123");
  assert.equal(state.attempts[1].baleTrackingNumber, "tracking-456");
  assert.equal(state.attempts[1].status, "paid");
  assert.equal(state.order.status, "paid");
});

test("rejects a successful-payment ID that differs from the pre-checkout ID", async () => {
  const state = fixture();
  assert.equal(await processBalePreCheckout(state.db, {
    id: "payment-123",
    invoicePayload: "payload-active",
    currency: "IRR",
    totalAmount: 4_000_000,
    checkedAt: new Date("2026-08-10T11:59:00.000Z"),
  }), true);

  await assert.rejects(processBaleSuccessfulPayment(state.db, {
    ...successfulPayment,
    balePaymentId: "payment-mismatched",
  }), /BALE_PAYMENT_IDENTIFIER_CONFLICT/);

  assert.equal(state.attempts[1].balePaymentId, "payment-123");
  assert.equal(state.order.status, "pending");
});

test("rejects pre-checkout when the attempt has no server deadline", async () => {
  const state = fixture();
  state.attempts[1].expiresAt = null;

  const accepted = await processBalePreCheckout(state.db, {
    id: "payment-123",
    invoicePayload: "payload-active",
    currency: "IRR",
    totalAmount: 4_000_000,
    checkedAt: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(accepted, false);
  assert.equal(state.attempts[1].balePaymentId, null);
});

test("rejects pre-checkout after the server deadline", async () => {
  const state = fixture();

  const accepted = await processBalePreCheckout(state.db, {
    id: "payment-123",
    invoicePayload: "payload-active",
    currency: "IRR",
    totalAmount: 4_000_000,
    checkedAt: new Date("2026-08-10T12:15:00.000Z"),
  });

  assert.equal(accepted, false);
  assert.equal(state.attempts[1].balePreCheckoutAt, null);
});

test("rejects a pre-checkout identifier uniqueness race without leaking Prisma errors", async () => {
  const state = fixture();
  state.failIdentifierWrites(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

  const accepted = await processBalePreCheckout(state.db, {
    id: "payment-123",
    invoicePayload: "payload-active",
    currency: "IRR",
    totalAmount: 4_000_000,
    checkedAt: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(accepted, false);
  assert.equal(state.attempts[1].balePaymentId, null);
});

function webhookRequest(update: unknown) {
  return new NextRequest("http://localhost/api/bale/webhook/secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
}

test("does not send an invoice when the attempt has no server deadline", async () => {
  const state = fixture();
  state.attempts[1].expiresAt = null;
  let invoicesSent = 0;

  const response = await handleBaleWebhook(
    webhookRequest({ message: { text: "/start payload-active", chat: { id: 42 } } }),
    { params: { secret: "secret" } },
    {
      db: state.db,
      now: () => new Date("2026-08-10T12:00:00.000Z"),
      webhookSecret: "secret",
      sendInvoice: async () => { invoicesSent += 1; },
      answerPreCheckoutQuery: async () => undefined,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(invoicesSent, 0);
});

test("does not send an invoice after the server deadline", async () => {
  const state = fixture();
  let invoicesSent = 0;

  await handleBaleWebhook(
    webhookRequest({ message: { text: "/start payload-active", chat: { id: 42 } } }),
    { params: { secret: "secret" } },
    {
      db: state.db,
      now: () => new Date("2026-08-10T12:15:00.000Z"),
      webhookSecret: "secret",
      sendInvoice: async () => { invoicesSent += 1; },
      answerPreCheckoutQuery: async () => undefined,
    },
  );

  assert.equal(invoicesSent, 0);
});

test("retries a rollback-safe finalization after a transient SQLite lock", async () => {
  const state = fixture();
  state.failTransactions(Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" }), null);

  const result = await processBaleSuccessfulPayment(state.db, successfulPayment);

  assert.equal(result, "paid");
  assert.equal(state.order.status, "paid");
  assert.equal(state.attempts[1].status, "paid");
});

test("preserves received identifiers when finalization retries are exhausted", async () => {
  const state = fixture();
  const locked = () => Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  state.failTransactions(null, locked(), locked(), locked());

  await assert.rejects(processBaleSuccessfulPayment(state.db, successfulPayment), /database is locked/);

  assert.equal(state.order.status, "pending");
  assert.equal(state.attempts[1].status, "pending");
  assert.equal(state.attempts[1].balePaymentId, "payment-123");
  assert.equal(state.attempts[1].baleTrackingNumber, "tracking-456");
  assert.equal(state.attempts[1].baleVerificationStatus, "received");
});

test("returns a server error while retaining evidence when webhook finalization fails", async () => {
  const state = fixture();
  const locked = () => Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  state.failTransactions(null, locked(), locked(), locked());
  const originalSecret = process.env.BALE_WEBHOOK_SECRET;
  process.env.BALE_WEBHOOK_SECRET = "secret";

  try {
    const response = await handleBaleWebhook(
      webhookRequest({
        message: {
          successful_payment: {
            invoice_payload: "payload-active",
            currency: "IRR",
            total_amount: 4_000_000,
            telegram_payment_charge_id: "payment-123",
            provider_payment_charge_id: "tracking-456",
          },
        },
      }),
      { params: { secret: "secret" } },
      {
        db: state.db,
        now: () => new Date("2026-08-10T12:00:00.000Z"),
        webhookSecret: "secret",
        sendInvoice: async () => undefined,
        answerPreCheckoutQuery: async () => undefined,
        onError: () => undefined,
      },
    );

    assert.equal(response.status, 500);
    assert.equal(state.attempts[1].balePaymentId, "payment-123");
    assert.equal(state.attempts[1].baleTrackingNumber, "tracking-456");
  } finally {
    if (originalSecret === undefined) delete process.env.BALE_WEBHOOK_SECRET;
    else process.env.BALE_WEBHOOK_SECRET = originalSecret;
  }
});

test("preserves original paid evidence when the same attempt receives a distinct charge", async () => {
  const state = fixture();
  assert.equal(await processBaleSuccessfulPayment(state.db, successfulPayment), "paid");

  await assert.rejects(processBaleSuccessfulPayment(state.db, {
    ...successfulPayment,
    balePaymentId: "payment-other",
    baleTrackingNumber: "tracking-other",
  }), /BALE_PAYMENT_IDENTIFIER_CONFLICT/);

  assert.equal(state.attempts[1].status, "paid");
  assert.equal(state.attempts[1].balePaymentId, "payment-123");
  assert.equal(state.attempts[1].baleTrackingNumber, "tracking-456");
  assert.equal(state.order.baleTransactionRef, "tracking-456");
});

test("rejects a mismatched identifier pair already associated with the target attempt", async () => {
  const state = fixture();
  state.attempts[1].balePaymentId = "payment-123";
  state.attempts[1].baleTrackingNumber = "tracking-original";

  await assert.rejects(processBaleSuccessfulPayment(state.db, successfulPayment), /BALE_PAYMENT_IDENTIFIER_CONFLICT/);

  assert.equal(state.attempts[1].baleTrackingNumber, "tracking-original");
  assert.equal(state.order.status, "pending");
});

test("handles an exact globally-owned payment pair idempotently", async () => {
  const state = fixture();
  state.attempts[0].status = "paid";
  state.attempts[0].balePaymentId = "payment-123";
  state.attempts[0].baleTrackingNumber = "tracking-456";
  state.order.status = "paid";
  state.order.activeAttemptId = "attempt-old";
  state.order.baleTransactionRef = "tracking-456";

  const result = await processBaleSuccessfulPayment(state.db, successfulPayment);

  assert.equal(result, "already_paid");
  assert.equal(state.attempts[1].balePaymentId, null);
  assert.equal(state.order.activeAttemptId, "attempt-old");
});

test("rejects cross-attempt reuse of only one globally unique identifier", async () => {
  const state = fixture();
  state.attempts[0].balePaymentId = "payment-123";
  state.attempts[0].baleTrackingNumber = "tracking-original";

  await assert.rejects(processBaleSuccessfulPayment(state.db, successfulPayment), /BALE_PAYMENT_IDENTIFIER_CONFLICT/);

  assert.equal(state.attempts[1].balePaymentId, null);
  assert.equal(state.attempts[0].baleTrackingNumber, "tracking-original");
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

test("rejects a successful Bale response with malformed non-JSON content", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.BALE_BOT_TOKEN;
  process.env.BALE_BOT_TOKEN = "bot-token";
  global.fetch = (async () => new Response("not-json", { status: 200, headers: { "Content-Type": "text/plain" } })) as typeof fetch;

  try {
    await assert.rejects(sendMessage("chat-1", "hello"), /BALE_SENDMESSAGE_PROTOCOL_ERROR/);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = originalToken;
  }
});

async function withBaleResponse<T>(payload: unknown, action: () => Promise<T>) {
  const originalFetch = global.fetch;
  const originalToken = process.env.BALE_BOT_TOKEN;
  process.env.BALE_BOT_TOKEN = "bot-token";
  global.fetch = (async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;
  try {
    return await action();
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = originalToken;
  }
}

test("rejects an empty Bale response envelope", async () => {
  await withBaleResponse({}, () => assert.rejects(sendMessage("chat-1", "hello"), /BALE_SENDMESSAGE_PROTOCOL_ERROR/));
});

test("rejects an array Bale response envelope", async () => {
  await withBaleResponse([], () => assert.rejects(sendMessage("chat-1", "hello"), /BALE_SENDMESSAGE_PROTOCOL_ERROR/));
});

test("rejects a successful Bale envelope without a result property", async () => {
  await withBaleResponse({ ok: true }, () => assert.rejects(sendMessage("chat-1", "hello"), /BALE_SENDMESSAGE_PROTOCOL_ERROR/));
});

test("rejects a Bale envelope with result but no explicit success flag", async () => {
  await withBaleResponse({ result: true }, () => assert.rejects(sendMessage("chat-1", "hello"), /BALE_SENDMESSAGE_PROTOCOL_ERROR/));
});

test("preserves valid Bale boolean, string, and object result values", async () => {
  assert.equal(await withBaleResponse({ ok: true, result: false }, () => sendMessage("chat-1", "hello")), false);
  assert.equal(await withBaleResponse({ ok: true, result: true }, () => sendMessage("chat-1", "hello")), true);
  assert.equal(await withBaleResponse({ ok: true, result: "invoice-link" }, () => sendMessage("chat-1", "hello")), "invoice-link");
  assert.deepEqual(await withBaleResponse({ ok: true, result: { message_id: 42 } }, () => sendMessage("chat-1", "hello")), { message_id: 42 });
});
