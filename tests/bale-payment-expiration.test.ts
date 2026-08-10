import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import prisma from "../lib/prisma";
import { generateToken } from "../lib/auth";
import { POST as createPayment, GET as getPayments } from "../app/api/payments/route";
import { POST as changeMethod } from "../app/api/payments/[id]/change-method/route";
import { POST as expirePayment } from "../app/api/payments/[id]/expire/route";

const token = generateToken({ id: "user-1", email: "user@example.com", role: "user" });
process.env.PAYMENT_CARD_ENCRYPTION_KEY ||= "00".repeat(32);

function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function paymentApplication() {
  return {
    id: "application-1",
    userId: "user-1",
    status: "pending_payment",
    discountCode: null,
    discountDocumentUrl: null,
    finalAmountTomans: 400_000,
    paymentOrder: null,
    course: { id: "course-1", published: true, scheduleStatus: "upcoming" },
  };
}

async function captureCreatedPayment(method: "bale_wallet" | "card_to_card") {
  const original = {
    applicationFind: prisma.courseApplication.findUnique,
    orderCreate: prisma.paymentOrder.create,
    attemptFind: prisma.paymentAttempt.findFirst,
    orderUpdate: prisma.paymentOrder.update,
    settingsFind: prisma.paymentSettings.findUnique,
  };
  let createdData: any;
  (prisma.courseApplication as any).findUnique = async () => paymentApplication();
  (prisma.paymentOrder as any).create = async ({ data }: any) => {
    createdData = data;
    return { id: "order-1", ...data };
  };
  (prisma.paymentAttempt as any).findFirst = async () => ({ id: "attempt-1" });
  (prisma.paymentOrder as any).update = async () => ({});
  (prisma.paymentSettings as any).findUnique = async () => null;

  try {
    const response = await createPayment(request("http://localhost/api/payments", "POST", {
      applicationId: "application-1",
      method,
      ...(method === "card_to_card" ? { payerCardNumber: "6037997512345670" } : {}),
    }));
    assert.equal(response.status, 201);
    return createdData;
  } finally {
    (prisma.courseApplication as any).findUnique = original.applicationFind;
    (prisma.paymentOrder as any).create = original.orderCreate;
    (prisma.paymentAttempt as any).findFirst = original.attemptFind;
    (prisma.paymentOrder as any).update = original.orderUpdate;
    (prisma.paymentSettings as any).findUnique = original.settingsFind;
  }
}

test("creates each Bale order and attempt with the same server-owned 15-minute deadline", async () => {
  const before = Date.now();
  const data = await captureCreatedPayment("bale_wallet");
  const after = Date.now();

  assert.ok(data.expiresAt instanceof Date);
  assert.equal(data.attempts.create.expiresAt, data.expiresAt);
  assert.ok(data.expiresAt.getTime() >= before + 15 * 60_000);
  assert.ok(data.expiresAt.getTime() <= after + 15 * 60_000);
});

test("explicitly clears order and attempt deadlines for card-to-card creation", async () => {
  const data = await captureCreatedPayment("card_to_card");

  assert.equal(data.expiresAt, null);
  assert.equal(data.attempts.create.expiresAt, null);
});

type ExpirationState = {
  order: { id: string; userId: string; status: string; method: string; activeAttemptId: string; expiresAt: Date | null };
  attempt: { id: string; status: string; method: string; expiresAt: Date | null; paidAt: Date | null };
  attemptUpdates: number;
  orderUpdates: number;
};

function expirationFixture(status = "pending", attemptStatus = "pending") {
  const state: ExpirationState = {
    order: { id: "order-1", userId: "user-1", status, method: "bale_wallet", activeAttemptId: "attempt-1", expiresAt: new Date("2026-08-10T12:15:00.000Z") },
    attempt: { id: "attempt-1", status: attemptStatus, method: "bale_wallet", expiresAt: new Date("2026-08-10T12:15:00.000Z"), paidAt: attemptStatus === "paid" ? new Date("2026-08-10T12:15:00.000Z") : null },
    attemptUpdates: 0,
    orderUpdates: 0,
  };
  const tx = {
    paymentOrder: {
      findFirst: async () => ({ ...state.order }),
      update: async ({ data }: any) => {
        state.orderUpdates += 1;
        Object.assign(state.order, data);
        return { ...state.order };
      },
    },
    paymentAttempt: {
      findUnique: async () => ({ ...state.attempt }),
      update: async ({ data }: any) => {
        state.attemptUpdates += 1;
        Object.assign(state.attempt, data);
        return { ...state.attempt };
      },
    },
  };
  return { state, db: { $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx) } };
}

test("expires the active Bale attempt and order at the server deadline", async () => {
  const { state, db } = expirationFixture();

  const first = await expirePayment(
    request("http://localhost/api/payments/order-1/expire", "POST"),
    { params: { id: "order-1" } },
    { db, now: () => new Date("2026-08-10T12:15:00.000Z") },
  );
  const second = await expirePayment(
    request("http://localhost/api/payments/order-1/expire", "POST"),
    { params: { id: "order-1" } },
    { db, now: () => new Date("2026-08-10T12:16:00.000Z") },
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(state.attempt.status, "expired");
  assert.equal(state.order.status, "expired");
  assert.equal(state.attemptUpdates, 1);
  assert.equal(state.orderUpdates, 1);
});

test("expiration re-read leaves a payment finalized at the deadline untouched", async () => {
  const { state, db } = expirationFixture("paid", "paid");

  const response = await expirePayment(
    request("http://localhost/api/payments/order-1/expire", "POST"),
    { params: { id: "order-1" } },
    { db, now: () => new Date("2026-08-10T12:15:00.000Z") },
  );
  const body = await response.json();

  assert.equal(body.order.status, "paid");
  assert.equal(state.attempt.status, "paid");
  assert.equal(state.attemptUpdates, 0);
  assert.equal(state.orderUpdates, 0);
});

function restartFixture(targetMethod: "bale_wallet" | "card_to_card") {
  const oldPayload = "payment:PAY-1:old";
  const active = { id: "attempt-1", sequence: 1, method: "bale_wallet", status: "expired", balePayload: oldPayload };
  let attemptData: any;
  let orderData: any;
  const tx = {
    paymentOrder: {
      findFirst: async () => ({ id: "order-1", orderNumber: "PAY-1", userId: "user-1", status: "expired", method: "bale_wallet", amountTomans: 400_000, amountRials: 4_000_000, attempts: [active] }),
      update: async ({ data }: any) => {
        orderData = data;
        return { id: "order-1", ...data };
      },
    },
    paymentAttempt: {
      update: async () => { throw new Error("expired history must not be invalidated"); },
      create: async ({ data }: any) => {
        attemptData = data;
        return { id: "attempt-2", ...data };
      },
    },
  };
  const db = {
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    paymentSettings: { findUnique: async () => null },
  };
  const body = targetMethod === "card_to_card" ? { method: targetMethod, payerCardNumber: "6037997512345670" } : { method: targetMethod };
  return { oldPayload, body, db, attempt: () => attemptData, order: () => orderData };
}

test("restarts an expired Bale attempt with a new sequence, payload, and deadline", async () => {
  const state = restartFixture("bale_wallet");

  const response = await changeMethod(
    request("http://localhost/api/payments/order-1/change-method", "POST", state.body),
    { params: { id: "order-1" } },
    { db: state.db, now: () => new Date("2026-08-10T13:00:00.000Z") },
  );

  assert.equal(response.status, 200);
  assert.equal(state.attempt().sequence, 2);
  assert.notEqual(state.attempt().balePayload, state.oldPayload);
  assert.equal(state.attempt().expiresAt.toISOString(), "2026-08-10T13:15:00.000Z");
  assert.equal(state.order().expiresAt, state.attempt().expiresAt);
});

test("switching an expired Bale order to card-to-card clears both deadlines", async () => {
  const state = restartFixture("card_to_card");

  const response = await changeMethod(
    request("http://localhost/api/payments/order-1/change-method", "POST", state.body),
    { params: { id: "order-1" } },
    { db: state.db, now: () => new Date("2026-08-10T13:00:00.000Z") },
  );

  assert.equal(response.status, 200);
  assert.equal(state.attempt().expiresAt, null);
  assert.equal(state.order().expiresAt, null);
});

test("GET normalizes a stale pending Bale deadline before returning payment state", async () => {
  const originalFindMany = prisma.paymentOrder.findMany;
  const originalTransaction = prisma.$transaction;
  const stale = { id: "order-1", userId: "user-1", status: "pending", method: "bale_wallet", activeAttemptId: "attempt-1", expiresAt: new Date(0), attempts: [{ id: "attempt-1", status: "pending", method: "bale_wallet", expiresAt: new Date(0) }] };
  let reads = 0;
  (prisma.paymentOrder as any).findMany = async () => {
    reads += 1;
    return [{ ...stale, attempts: stale.attempts.map((attempt) => ({ ...attempt })) }];
  };
  (prisma as any).$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    paymentOrder: {
      findFirst: async () => ({ ...stale }),
      update: async ({ data }: any) => Object.assign(stale, data),
    },
    paymentAttempt: {
      findUnique: async () => ({ ...stale.attempts[0] }),
      update: async ({ data }: any) => Object.assign(stale.attempts[0], data),
    },
  });

  try {
    const response = await getPayments(request("http://localhost/api/payments?applicationId=application-1"));
    const body = await response.json();

    assert.equal(body.orders[0].status, "expired");
    assert.equal(body.orders[0].attempts[0].status, "expired");
    assert.equal(reads, 2);
  } finally {
    (prisma.paymentOrder as any).findMany = originalFindMany;
    (prisma as any).$transaction = originalTransaction;
  }
});
