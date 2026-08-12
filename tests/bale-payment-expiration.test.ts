import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { generateToken } from "../lib/auth";
import { POST as createPayment, GET as getPayments } from "../app/api/payments/route";
import { POST as changeMethod } from "../app/api/payments/[id]/change-method/route";
import { POST as expirePayment } from "../app/api/payments/[id]/expire/route";
import { POST as submitReceipt } from "../app/api/payments/[id]/receipt/route";

const token = generateToken({ id: "user-1", email: "user@example.com", role: "user" });
process.env.PAYMENT_CARD_ENCRYPTION_KEY ||= "00".repeat(32);

function request(url: string, method = "GET", body?: unknown, authorization = `Bearer ${token}`) {
  return new NextRequest(url, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function paymentApplication(paymentOrder: unknown = null) {
  return {
    id: "application-1",
    userId: "user-1",
    status: "pending_payment",
    discountCode: null,
    discountDocumentUrl: null,
    finalAmountTomans: 400_000,
    paymentOrder,
    course: { id: "course-1", published: true, scheduleStatus: "upcoming" },
  };
}

function creationFixture(options: { failAttemptLookup?: boolean; createConflict?: boolean; existingOrder?: boolean } = {}) {
  const state: { order: any; attempt: any; transactions: number } = { order: null, attempt: null, transactions: 0 };
  if (options.existingOrder) {
    state.order = { id: "order-existing", orderNumber: "PAY-EXISTING", userId: "user-1", method: "bale_wallet", status: "pending", activeAttemptId: "attempt-existing", amountTomans: 400_000, balePayload: "order-secret", expiresAt: new Date("2026-08-10T12:15:00.000Z"), createdAt: new Date("2026-08-10T12:00:00.000Z") };
    state.attempt = { id: "attempt-existing", orderId: "order-existing", sequence: 1, method: "bale_wallet", status: "pending", balePayload: "attempt-secret", balePaymentId: "payment-secret", baleTrackingNumber: "tracking-secret", baleReceiptReference: "receipt-secret", baleVerificationStatus: "received", baleInvoiceClaimId: "claim-secret", futureSecret: "future-secret", createdAt: new Date("2026-08-10T12:00:00.000Z"), expiresAt: new Date("2026-08-10T12:15:00.000Z") };
  }
  const selectedOrder = () => state.order ? {
    rejectionReason: null,
    receiptUrl: null,
    createdAt: new Date("2026-08-10T12:00:00.000Z"),
    course: { id: "course-1", title: "Course", slug: "course", thumbnail: null },
    application: { id: "application-1", status: "pending_payment", finalAmountTomans: 400_000 },
    ...state.order,
    attempts: state.attempt ? [{
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      expiresAt: null,
      ...state.attempt,
    }] : [],
  } : null;
  const db = {
    courseApplication: { findUnique: async () => paymentApplication(options.existingOrder ? { id: state.order.id, method: state.order.method } : null) },
    paymentSettings: { findUnique: async () => null },
    paymentOrder: {
      findUnique: async () => selectedOrder(),
      findFirst: async () => selectedOrder(),
      create: async ({ data }: any) => {
        state.order = { id: "order-1", ...data };
        state.attempt = { id: "attempt-1", orderId: "order-1", ...data.attempts.create };
        return { ...state.order };
      },
      update: async ({ data }: any) => {
        Object.assign(state.order, data);
        return { ...state.order };
      },
    },
    paymentAttempt: {
      findFirst: async () => {
        if (options.failAttemptLookup) throw new Error("attempt lookup failed");
        return state.attempt ? { ...state.attempt } : null;
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      state.transactions += 1;
      const draft = { order: state.order ? { ...state.order } : null, attempt: state.attempt ? { ...state.attempt } : null };
      const tx = {
        paymentOrder: {
          create: async ({ data }: any) => {
            if (options.createConflict) {
              state.order = { id: "order-winner", activeAttemptId: "attempt-winner", ...data };
              state.attempt = { id: "attempt-winner", orderId: "order-winner", ...data.attempts.create };
              throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
            }
            draft.order = { id: "order-1", ...data };
            draft.attempt = { id: "attempt-1", orderId: "order-1", ...data.attempts.create };
            return { ...draft.order };
          },
          update: async ({ where, data }: any) => {
            assert.equal(where.id, "order-1");
            Object.assign(draft.order, data);
            return { ...draft.order };
          },
        },
        paymentAttempt: {
          findFirst: async ({ where }: any) => {
            if (options.failAttemptLookup) throw new Error("attempt lookup failed");
            return draft.attempt?.orderId === where.orderId ? { ...draft.attempt } : null;
          },
        },
      };
      const result = await callback(tx);
      state.order = draft.order;
      state.attempt = draft.attempt;
      return result;
    },
  };
  return { state, db };
}

const safeOrderKeys = ["amountTomans", "application", "course", "createdAt", "expiresAt", "id", "method", "orderNumber", "receiptUrl", "rejectionReason", "status", "attempts"];
const safeAttemptKeys = ["createdAt", "expiresAt", "id", "method", "sequence", "status"];

function assertSafePaymentOrder(order: any) {
  assert.deepEqual(Object.keys(order).sort(), [...safeOrderKeys].sort());
  assert.deepEqual(Object.keys(order.attempts[0]).sort(), [...safeAttemptKeys].sort());
  const serialized = JSON.stringify(order);
  assert.doesNotMatch(serialized, /order-secret|attempt-secret|payment-secret|tracking-secret|receipt-secret|claim-secret|future-secret/);
  assert.equal(order.balePayload, undefined);
}

async function createWithFixture(method: "bale_wallet" | "card_to_card", fixture = creationFixture()) {
  const now = new Date("2026-08-10T12:00:00.000Z");
  const response = await createPayment(
    request("http://localhost/api/payments", "POST", {
      applicationId: "application-1",
      method,
      ...(method === "card_to_card" ? { payerCardNumber: "6037997512345670" } : {}),
    }),
    { params: {} },
    { db: fixture.db, now: () => now, onError: () => undefined },
  );
  return { ...fixture, response, now };
}

test("atomically creates a Bale order, attempt, active pointer, and exact deadline", async () => {
  const { state, response } = await createWithFixture("bale_wallet");
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(state.transactions, 1);
  assert.equal(state.order.activeAttemptId, "attempt-1");
  assert.equal(state.order.expiresAt.toISOString(), "2026-08-10T12:15:00.000Z");
  assert.equal(state.attempt.expiresAt, state.order.expiresAt);
  assertSafePaymentOrder(body.order);
  assert.match(body.baleBotUrl, /^https:\/\/ble\.ir\//);
});

test("existing application POST returns only the safe order and attempt projection", async () => {
  const fixture = creationFixture({ existingOrder: true });
  const { response } = await createWithFixture("bale_wallet", fixture);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.existing, true);
  assertSafePaymentOrder(body.order);
  assert.equal(body.baleBotUrl, "https://ble.ir/imamruhollahschool_bot?start=attempt-secret");
});

test("rolls back the initial order when active-attempt setup fails", async () => {
  const fixture = creationFixture({ failAttemptLookup: true });
  const { state, response } = await createWithFixture("bale_wallet", fixture);

  assert.equal(response.status, 500);
  assert.equal(state.order, null);
  assert.equal(state.attempt, null);
});

test("returns the concurrently created order after an initial P2002", async () => {
  const fixture = creationFixture({ createConflict: true });
  const { response } = await createWithFixture("bale_wallet", fixture);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.existing, true);
  assert.equal(body.order.id, "order-winner");
  assertSafePaymentOrder(body.order);
  assert.match(body.baleBotUrl, /^https:\/\/ble\.ir\//);
});

test("explicitly clears order and attempt deadlines for card-to-card creation", async () => {
  const { state, response } = await createWithFixture("card_to_card");

  assert.equal(response.status, 201);
  assert.equal(state.order.expiresAt, null);
  assert.equal(state.attempt.expiresAt, null);
});

type PaymentState = {
  order: any;
  attempts: any[];
  attemptUpdates: number;
  orderUpdates: number;
  transactions: number;
};

function transactionFixture(options: {
  status?: string;
  attemptStatus?: string;
  activeAttemptId?: string;
  attempts?: any[];
  failures?: Error[];
  afterFailure?: (state: PaymentState) => void;
} = {}) {
  const defaultAttempt = { id: "attempt-1", orderId: "order-1", sequence: 1, status: options.attemptStatus || "pending", method: "bale_wallet", createdAt: new Date("2026-08-10T12:00:00.000Z"), expiresAt: new Date("2026-08-10T12:15:00.000Z"), paidAt: null, balePayload: "payment:PAY-1:old" };
  const state: PaymentState = {
    order: { id: "order-1", orderNumber: "PAY-1", userId: "user-1", status: options.status || "pending", method: "bale_wallet", amountTomans: 400_000, amountRials: 4_000_000, activeAttemptId: options.activeAttemptId === undefined ? "attempt-1" : options.activeAttemptId, createdAt: new Date("2026-08-10T12:00:00.000Z"), expiresAt: new Date("2026-08-10T12:15:00.000Z") },
    attempts: (options.attempts || [defaultAttempt]).map((attempt) => ({ ...attempt })),
    attemptUpdates: 0,
    orderUpdates: 0,
    transactions: 0,
  };
  const failures = [...(options.failures || [])];

  function txFor(draft: PaymentState) {
    return {
      paymentOrder: {
        findFirst: async ({ where }: any) => draft.order.id === where.id && draft.order.userId === where.userId ? { ...draft.order } : null,
        update: async ({ where, data }: any) => {
          assert.equal(where.id, draft.order.id);
          draft.orderUpdates += 1;
          Object.assign(draft.order, data);
          return { ...draft.order };
        },
      },
      paymentAttempt: {
        findFirst: async ({ where, orderBy }: any) => {
          const matches = draft.attempts.filter((attempt) =>
            (where.id === undefined || attempt.id === where.id) &&
            (where.orderId === undefined || attempt.orderId === where.orderId),
          );
          if (orderBy?.sequence === "desc") matches.sort((a, b) => b.sequence - a.sequence);
          return matches[0] ? { ...matches[0] } : null;
        },
        updateMany: async ({ where, data }: any) => {
          assert.ok(where.id);
          assert.ok(where.orderId);
          const attempt = draft.attempts.find((item) => item.id === where.id && item.orderId === where.orderId);
          if (!attempt) return { count: 0 };
          draft.attemptUpdates += 1;
          Object.assign(attempt, data);
          return { count: 1 };
        },
        create: async ({ data }: any) => {
          if (draft.attempts.some((attempt) => attempt.orderId === data.orderId && attempt.sequence === data.sequence)) {
            throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          }
          const attempt = { id: `attempt-${data.sequence}`, ...data };
          draft.attempts.push(attempt);
          return { ...attempt };
        },
      },
    };
  }

  const db = {
    paymentSettings: { findUnique: async () => null },
    paymentOrder: {
      findFirst: async ({ where }: any) => state.order.id === where.id && state.order.userId === where.userId ? { ...state.order } : null,
      findMany: async () => [{ ...state.order, attempts: state.attempts.filter((attempt) => attempt.orderId === state.order.id).map((attempt) => ({ ...attempt })) }],
    },
    paymentAttempt: {
      findFirst: async ({ where, orderBy }: any) => {
        const matches = state.attempts.filter((attempt) =>
          (where.id === undefined || attempt.id === where.id) &&
          (where.orderId === undefined || attempt.orderId === where.orderId),
        );
        if (orderBy?.sequence === "desc") matches.sort((a, b) => b.sequence - a.sequence);
        return matches[0] ? { ...matches[0] } : null;
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      state.transactions += 1;
      const failure = failures.shift();
      if (failure) {
        options.afterFailure?.(state);
        throw failure;
      }
      const draft: PaymentState = {
        order: { ...state.order },
        attempts: state.attempts.map((attempt) => ({ ...attempt })),
        attemptUpdates: state.attemptUpdates,
        orderUpdates: state.orderUpdates,
        transactions: state.transactions,
      };
      const result = await callback(txFor(draft));
      state.order = draft.order;
      state.attempts = draft.attempts;
      state.attemptUpdates = draft.attemptUpdates;
      state.orderUpdates = draft.orderUpdates;
      return result;
    },
  };
  return { state, db };
}

const locked = () => Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });

test("expiration retries contention and remains idempotent", async () => {
  const { state, db } = transactionFixture({ failures: [locked()] });

  const first = await expirePayment(request("http://localhost/api/payments/order-1/expire", "POST"), { params: { id: "order-1" } }, { db, now: () => new Date("2026-08-10T12:15:00.000Z") });
  const second = await expirePayment(request("http://localhost/api/payments/order-1/expire", "POST"), { params: { id: "order-1" } }, { db, now: () => new Date("2026-08-10T12:16:00.000Z") });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(state.transactions, 3);
  assert.equal(state.order.status, "expired");
  assert.equal(state.attempts[0].status, "expired");
  assert.equal(state.attemptUpdates, 1);
  assert.equal(state.orderUpdates, 1);
});

test("expire endpoint commits a legacy deadline and expires the old pending attempt", async () => {
  const fixture = transactionFixture();
  fixture.state.order.expiresAt = null;
  fixture.state.attempts[0].expiresAt = null;

  const response = await expirePayment(
    request("http://localhost/api/payments/order-1/expire", "POST"),
    { params: { id: "order-1" } },
    { db: fixture.db, now: () => new Date("2026-08-10T12:15:00.000Z") },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.order.status, "expired");
  assert.equal(fixture.state.order.expiresAt.toISOString(), "2026-08-10T12:15:00.000Z");
  assert.equal(fixture.state.attempts[0].expiresAt.toISOString(), "2026-08-10T12:15:00.000Z");
});

test("a payment finalized during expiration contention wins at the deadline", async () => {
  const { state, db } = transactionFixture({
    failures: [locked()],
    afterFailure: (current) => {
      current.order.status = "paid";
      current.attempts[0].status = "paid";
      current.attempts[0].paidAt = new Date("2026-08-10T12:15:00.000Z");
    },
  });

  const response = await expirePayment(request("http://localhost/api/payments/order-1/expire", "POST"), { params: { id: "order-1" } }, { db, now: () => new Date("2026-08-10T12:15:00.000Z") });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.order.status, "paid");
  assert.equal(state.attempts[0].status, "paid");
  assert.equal(state.attemptUpdates, 0);
});

test("expiration never reads or mutates a foreign active attempt", async () => {
  const foreign = { id: "attempt-foreign", orderId: "order-foreign", sequence: 9, status: "pending", method: "bale_wallet", expiresAt: new Date(0) };
  const { state, db } = transactionFixture({ activeAttemptId: foreign.id, attempts: [foreign] });

  const response = await expirePayment(request("http://localhost/api/payments/order-1/expire", "POST"), { params: { id: "order-1" } }, { db, now: () => new Date("2026-08-10T12:15:00.000Z") });

  assert.equal(response.status, 200);
  assert.equal(state.order.status, "pending");
  assert.equal(state.attempts[0].status, "pending");
  assert.equal(state.attemptUpdates, 0);
});

test("expiration rejects unauthenticated and foreign-order requests", async () => {
  const { db } = transactionFixture();
  const unauthorized = await expirePayment(request("http://localhost/api/payments/order-1/expire", "POST", undefined, ""), { params: { id: "order-1" } }, { db });
  const foreign = await expirePayment(request("http://localhost/api/payments/order-foreign/expire", "POST"), { params: { id: "order-foreign" } }, { db });

  assert.equal(unauthorized.status, 401);
  assert.equal(foreign.status, 404);
});

test("restart uses activeAttemptId and preserves monotonic sequence", async () => {
  const active = { id: "attempt-1", orderId: "order-1", sequence: 1, status: "expired", method: "bale_wallet", expiresAt: new Date(0), balePayload: "old" };
  const later = { id: "attempt-3", orderId: "order-1", sequence: 3, status: "invalidated", method: "card_to_card", expiresAt: null };
  const { state, db } = transactionFixture({ status: "expired", attempts: [active, later] });

  const response = await changeMethod(request("http://localhost/api/payments/order-1/change-method", "POST", { method: "bale_wallet" }), { params: { id: "order-1" } }, { db, now: () => new Date("2026-08-10T13:00:00.000Z") });

  assert.equal(response.status, 200);
  assert.equal(state.order.activeAttemptId, "attempt-4");
  assert.equal(state.attempts.find((attempt) => attempt.id === "attempt-4")?.sequence, 4);
  assert.equal(state.attempts.find((attempt) => attempt.id === "attempt-1")?.status, "expired");
});

test("restart recovers a malformed order without mutating a foreign active attempt", async () => {
  const own = { id: "attempt-3", orderId: "order-1", sequence: 3, status: "pending", method: "bale_wallet", expiresAt: new Date(0) };
  const foreign = { id: "attempt-foreign", orderId: "order-foreign", sequence: 20, status: "pending", method: "bale_wallet", expiresAt: new Date(0) };
  const { state, db } = transactionFixture({ activeAttemptId: foreign.id, attempts: [own, foreign] });

  const response = await changeMethod(request("http://localhost/api/payments/order-1/change-method", "POST", { method: "bale_wallet" }), { params: { id: "order-1" } }, { db, now: () => new Date("2026-08-10T13:00:00.000Z") });

  assert.equal(response.status, 200);
  assert.equal(state.order.activeAttemptId, "attempt-4");
  assert.equal(state.attempts.find((attempt) => attempt.id === foreign.id)?.status, "pending");
  assert.equal(state.attempts.find((attempt) => attempt.id === "attempt-4")?.sequence, 4);
});

test("a transient restart lock with unchanged state retries the requested method change", async () => {
  const fixture = transactionFixture({ failures: [locked()] });

  const response = await changeMethod(request("http://localhost/api/payments/order-1/change-method", "POST", { method: "card_to_card", payerCardNumber: "6037997512345670" }), { params: { id: "order-1" } }, { db: fixture.db, now: () => new Date("2026-08-10T12:01:00.000Z") });

  assert.equal(response.status, 200);
  assert.equal(fixture.state.order.method, "card_to_card");
  assert.equal(fixture.state.order.activeAttemptId, "attempt-2");
  assert.equal(fixture.state.attempts.find((attempt) => attempt.id === "attempt-1")?.status, "invalidated");
  assert.equal(fixture.state.attempts.find((attempt) => attempt.id === "attempt-2")?.sequence, 2);
});

test("a concurrent restart loser refreshes state and returns a meaningful conflict", async () => {
  const active = { id: "attempt-1", orderId: "order-1", sequence: 1, status: "expired", method: "bale_wallet", expiresAt: new Date(0) };
  const fixture = transactionFixture({ status: "expired", attempts: [active], failures: [Object.assign(new Error("Unique constraint failed"), { code: "P2002" })], afterFailure: (state) => {
    state.attempts.push({ id: "attempt-2", orderId: "order-1", sequence: 2, status: "pending", method: "bale_wallet", expiresAt: new Date("2026-08-10T13:15:00.000Z") });
    state.order.status = "pending";
    state.order.activeAttemptId = "attempt-2";
  } });

  const response = await changeMethod(request("http://localhost/api/payments/order-1/change-method", "POST", { method: "bale_wallet" }), { params: { id: "order-1" } }, { db: fixture.db, now: () => new Date("2026-08-10T13:00:00.000Z") });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.error, /دوباره|همزمان/);
  assert.equal(fixture.state.attempts.filter((attempt) => attempt.orderId === "order-1").length, 2);
  assert.equal(fixture.state.order.activeAttemptId, "attempt-2");
});

test("a concurrent different-method winner is not overwritten after restart retry", async () => {
  const active = { id: "attempt-1", orderId: "order-1", sequence: 1, status: "expired", method: "bale_wallet", expiresAt: new Date(0) };
  const fixture = transactionFixture({ status: "expired", attempts: [active], failures: [Object.assign(new Error("Transaction conflict"), { code: "P2034" })], afterFailure: (state) => {
    state.attempts.push({ id: "attempt-2", orderId: "order-1", sequence: 2, status: "awaiting_receipt", method: "card_to_card", expiresAt: null });
    state.order.status = "awaiting_receipt";
    state.order.method = "card_to_card";
    state.order.activeAttemptId = "attempt-2";
  } });

  const response = await changeMethod(request("http://localhost/api/payments/order-1/change-method", "POST", { method: "bale_wallet" }), { params: { id: "order-1" } }, { db: fixture.db, now: () => new Date("2026-08-10T13:00:00.000Z") });

  assert.equal(response.status, 409);
  assert.equal(fixture.state.order.method, "card_to_card");
  assert.equal(fixture.state.order.activeAttemptId, "attempt-2");
  assert.equal(fixture.state.attempts.length, 2);
});

test("exhausted restart uniqueness conflicts return 409 instead of an opaque server error", async () => {
  const conflict = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  const active = { id: "attempt-1", orderId: "order-1", sequence: 1, status: "expired", method: "bale_wallet", expiresAt: new Date(0) };
  const fixture = transactionFixture({ status: "expired", attempts: [active], failures: [conflict(), conflict(), conflict()] });

  const response = await changeMethod(request("http://localhost/api/payments/order-1/change-method", "POST", { method: "bale_wallet" }), { params: { id: "order-1" } }, { db: fixture.db, now: () => new Date("2026-08-10T13:00:00.000Z") });

  assert.equal(response.status, 409);
  assert.equal(fixture.state.order.activeAttemptId, "attempt-1");
  assert.equal(fixture.state.attempts.length, 1);
});

test("GET retries stale normalization and returns paid when finalization wins", async () => {
  const fixture = transactionFixture({ failures: [locked()], afterFailure: (state) => {
    state.order.status = "paid";
    state.attempts[0].status = "paid";
  } });
  fixture.state.order.expiresAt = new Date(0);
  fixture.state.attempts[0].expiresAt = new Date(0);

  const response = await getPayments(request("http://localhost/api/payments?applicationId=application-1"), { params: {} }, { db: fixture.db, now: () => new Date("2026-08-10T13:00:00.000Z") });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.orders[0].status, "paid");
  assert.equal(body.orders[0].attempts[0].status, "paid");
  assert.equal(fixture.state.transactions, 2);
  assert.equal(fixture.state.attemptUpdates, 0);
});

test("GET returns a server-owned deep link for the active pending Bale attempt", async () => {
  const active = { id: "attempt-1", orderId: "order-1", sequence: 1, status: "pending", method: "bale_wallet", expiresAt: new Date("2026-08-10T12:15:00.000Z"), balePayload: "payment:PAY-1:active" };
  const newerInactive = { id: "attempt-2", orderId: "order-1", sequence: 2, status: "pending", method: "bale_wallet", expiresAt: new Date("2026-08-10T12:15:00.000Z"), balePayload: "payment:PAY-1:not-active" };
  const fixture = transactionFixture({ attempts: [active, newerInactive] });
  fixture.state.order.balePayload = "payment:PAY-1:stale-order";

  const response = await getPayments(
    request("http://localhost/api/payments?applicationId=application-1"),
    { params: {} },
    {
      db: fixture.db,
      now: () => new Date("2026-08-10T12:05:00.000Z"),
      botUsername: () => "server_checkout_bot",
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(
    body.baleBotUrl,
    "https://ble.ir/server_checkout_bot?start=payment%3APAY-1%3Aactive",
  );
});

test("GET expires an old null-deadline legacy attempt and returns its effective deadline", async () => {
  const fixture = transactionFixture();
  fixture.state.order.createdAt = new Date("2026-08-10T12:00:00.000Z");
  fixture.state.order.expiresAt = null;
  fixture.state.attempts[0].createdAt = new Date("2026-08-10T12:00:00.000Z");
  fixture.state.attempts[0].expiresAt = null;

  const response = await getPayments(
    request("http://localhost/api/payments?applicationId=application-1"),
    { params: {} },
    { db: fixture.db, now: () => new Date("2026-08-10T12:16:00.000Z") },
  );
  const body = await response.json();

  assert.equal(body.orders[0].status, "expired");
  assert.equal(body.orders[0].attempts[0].status, "expired");
  assert.equal(body.orders[0].expiresAt, "2026-08-10T12:15:00.000Z");
  assert.equal(body.orders[0].attempts[0].expiresAt, "2026-08-10T12:15:00.000Z");
});

test("customer GET selects and returns only checkout-safe attempt fields", async () => {
  const fixture = transactionFixture();
  let query: any;
  const originalFindMany = fixture.db.paymentOrder.findMany;
  (fixture.db.paymentOrder as any).findMany = async (args: any) => {
    query = args;
    const orders = await originalFindMany();
    orders[0].attempts[0] = {
      ...orders[0].attempts[0],
      balePaymentId: "payment-secret",
      baleTrackingNumber: "tracking-secret",
      baleReceiptReference: "receipt-secret",
      baleVerificationStatus: "received",
    };
    return orders;
  };

  const response = await getPayments(
    request("http://localhost/api/payments?applicationId=application-1"),
    { params: {} },
    { db: fixture.db, now: () => new Date("2026-08-10T12:01:00.000Z") },
  );
  const body = await response.json();

  assert.deepEqual(Object.keys(query.select.attempts.select).sort(), ["createdAt", "expiresAt", "id", "method", "sequence", "status"]);
  assert.deepEqual(Object.keys(body.orders[0].attempts[0]).sort(), ["createdAt", "expiresAt", "id", "method", "sequence", "status"]);
});

test("receipt submission never mutates an active attempt owned by another order", async () => {
  const order = { id: "order-1", orderNumber: "PAY-1", amountTomans: 800_000, userId: "user-1", method: "card_to_card", status: "awaiting_receipt", activeAttemptId: "attempt-foreign", receiptSubmissionRevision: 0, user: { name: "هنرجو" }, course: { title: "دوره" } };
  const foreign = { id: "attempt-foreign", orderId: "order-foreign", status: "awaiting_receipt" };
  const form = new FormData();
  form.set("file", new File([new Uint8Array([1, 2, 3])], "receipt.png", { type: "image/png" }));
  const receiptRequest = new NextRequest("http://localhost/api/payments/order-1/receipt", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const db = {
    paymentOrder: { findFirst: async () => ({ ...order }) },
    paymentSettings: { findUnique: async () => null },
    $transaction: async (callback: (tx: any) => Promise<any>) => callback({
      paymentOrder: {
        findUnique: async () => ({ ...order }),
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => ({ ...order, status: "under_review", receiptSubmissionRevision: 1 }),
      },
      paymentAttempt: {
        findFirst: async ({ where }: any) => {
          assert.deepEqual(where, { id: "attempt-foreign", orderId: "order-1" });
          return null;
        },
        updateMany: async () => {
          foreign.status = "mutated";
          return { count: 1 };
        },
      },
      baleGroupEvent: { upsert: async () => undefined },
    }),
  };

  const response = await submitReceipt(receiptRequest, { params: { id: "order-1" } }, {
    db,
    mkdir: async () => undefined,
    writeFile: async () => undefined,
    randomUUID: () => "receipt-id",
    now: () => new Date("2026-08-10T13:00:00.000Z"),
    onError: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(foreign.status, "awaiting_receipt");
});
