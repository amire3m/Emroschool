import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { PATCH as reviewPayment } from "../app/api/admin/payments/[id]/route";

function makeDb(order: any) {
  const decisions: any[] = [];
  const grants: any[] = [];
  const events: Map<string, unknown> = new Map();
  const tx = {
    paymentOrder: {
      findUnique: async () => ({ ...order }),
      updateMany: async ({ where, data }: any) => {
        if (where.reviewVersion !== undefined && where.reviewVersion !== order.reviewVersion) return { count: 0 };
        if (where.status !== undefined && where.status !== order.status) return { count: 0 };
        Object.assign(order, data, { reviewVersion: (order.reviewVersion ?? 0) + 1 });
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...order }),
    },
    paymentAttempt: { updateMany: async () => ({ count: 1 }) },
    paymentReviewDecision: {
      create: async ({ data }: any) => { decisions.push(data); return data; },
      findMany: async ({ where }: any) => decisions.filter((d) => d.orderId === where.orderId),
    },
    enrollment: { upsert: async () => undefined },
    enrollmentGrant: {
      upsert: async ({ where, update, create }: any) => {
        const existing = grants.find((g) => g.sourceType === where.sourceType_sourceId.sourceType && g.sourceId === where.sourceType_sourceId.sourceId);
        if (existing) return Object.assign(existing, update);
        grants.push({ ...create, active: true, revokedAt: null });
        return grants.at(-1);
      },
      updateMany: async ({ where, data }: any) => {
        const matches = grants.filter((g) => g.sourceType === where.sourceType && g.sourceId === where.sourceId && (where.active === undefined || g.active === where.active));
        matches.forEach((g) => Object.assign(g, data));
        return { count: matches.length };
      },
      count: async ({ where }: any) => grants.filter((g) => g.userId === where.userId && g.courseId === where.courseId && (where.active === undefined || g.active === where.active)).length,
    },
    courseApplication: { update: async () => undefined },
    baleGroupEvent: {
      upsert: async (args: any) => {
        if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
        return events.get(args.where.eventKey);
      },
    },
  };
  const db = {
    $transaction: async <T>(fn: (tx: any) => Promise<T>) => fn(tx),
  };
  return { db, tx, decisions, grants, events };
}

test("UI: decision timeline shows history and current status", async () => {
  const order = { id: "order-timeline", method: "card_to_card", status: "paid", reviewVersion: 2, paidAt: new Date("2026-08-12T10:00:00.000Z"), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: "application-1", userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" }, application: { fullName: "Student" } };
  const { db, decisions } = makeDb(order);

  await reviewPayment(new NextRequest("http://test/api/admin/payments/order-timeline", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reverse_approval", reason: "wrong receipt", expectedReviewVersion: 2 }),
  }), { params: { id: order.id } }, {
    db: db as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date("2026-08-13T08:00:00.000Z"),
  } as any);

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].action, "reverse_approval");
  assert.equal(decisions[0].reason, "wrong receipt");
  assert.equal(decisions[0].fromStatus, "paid");
  assert.equal(decisions[0].toStatus, "review_reopened");
  assert.equal(decisions[0].reviewVersion, 3);
});

test("UI: reopen and reverse controls succeed for rejected and paid orders", async () => {
  for (const status of ["paid", "rejected"] as const) {
    const order = { id: `order-${status}`, method: "card_to_card", status, reviewVersion: status === "paid" ? 1 : 2, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
    const { db } = makeDb(order);
    const action = status === "paid" ? "reverse_approval" : "reopen_rejection";
    const response = await reviewPayment(new NextRequest(`http://test/api/admin/payments/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: "test reason", expectedReviewVersion: order.reviewVersion }),
    }), { params: { id: order.id } }, {
      db: db as any,
      authorize: async () => ({ id: "admin-1", name: "Admin" }),
      now: () => new Date(),
    } as any);
    assert.equal(response.status, 200, `Expected 200 for ${status}, got ${response.status}`);
  }
});

test("UI: correction requires reason and rejects empty reason", async () => {
  const order = { id: "order-no-reason", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
  const { db } = makeDb(order);

  const response = await reviewPayment(new NextRequest("http://test/api/admin/payments/order-no-reason", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reverse_approval", reason: "", expectedReviewVersion: 1 }),
  }), { params: { id: order.id } }, {
    db: db as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date(),
  } as any);
  assert.equal(response.status, 400);
});

test("UI: 409 refresh when expectedReviewVersion is stale", async () => {
  const staleOrder = { id: "order-stale", method: "card_to_card", status: "paid", reviewVersion: 3, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
  const { db: db1 } = makeDb(staleOrder);

  const staleResponse = await reviewPayment(new NextRequest("http://test/api/admin/payments/order-stale", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reverse_approval", reason: "mistake", expectedReviewVersion: 1 }),
  }), { params: { id: staleOrder.id } }, {
    db: db1 as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date(),
  } as any);
  assert.equal(staleResponse.status, 409);

  const freshOrder = { id: "order-stale", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
  const { db: db2 } = makeDb(freshOrder);
  const freshResponse = await reviewPayment(new NextRequest("http://test/api/admin/payments/order-stale", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reverse_approval", reason: "mistake", expectedReviewVersion: 1 }),
  }), { params: { id: "order-stale" } }, {
    db: db2 as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date(),
  } as any);
  assert.equal(freshResponse.status, 200);
});

test("UI: suspended-access when enrollment grant inactive after reversal", async () => {
  const order = { id: "order-suspended", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
  const { db, grants } = makeDb(order);
  grants.push({ sourceType: "payment_card", sourceId: order.id, userId: order.userId, courseId: order.courseId, active: false, revokedAt: new Date() });

  await reviewPayment(new NextRequest("http://test/api/admin/payments/order-suspended", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reverse_approval", reason: "wrong", expectedReviewVersion: 1 }),
  }), { params: { id: order.id } }, {
    db: db as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date(),
  } as any);

  const cardGrant = grants.find((g) => g.sourceType === "payment_card");
  assert.equal(cardGrant?.active, false);
});

test("UI: correction queues payment_review_decision event to Bale group", async () => {
  const order = { id: "order-event", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
  const { db, events } = makeDb(order);

  await reviewPayment(new NextRequest("http://test/api/admin/payments/order-event", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reverse_approval", reason: "wrong receipt", expectedReviewVersion: 1 }),
  }), { params: { id: order.id } }, {
    db: db as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date("2026-08-13T08:00:00.000Z"),
  } as any);

  const keys = [...events.keys()];
  assert.ok(keys.some((k) => k.startsWith("payment-review-decision:")));
});

test("UI: approval queues payment_paid event (not correction event)", async () => {
  const order = { id: "order-approve", method: "card_to_card", status: "under_review", reviewVersion: 0, receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1", user: { name: "Student" }, course: { title: "Course" } };
  const { db, events } = makeDb(order);

  await reviewPayment(new NextRequest("http://test/api/admin/payments/order-approve", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", expectedReviewVersion: 0 }),
  }), { params: { id: order.id } }, {
    db: db as any,
    authorize: async () => ({ id: "admin-1", name: "Admin" }),
    now: () => new Date("2026-08-13T08:00:00.000Z"),
  } as any);

  const keys = [...events.keys()];
  assert.ok(keys.some((k) => k.startsWith("payment-paid:")));
  assert.ok(!keys.some((k) => k.startsWith("payment-review-decision:")), "approval should not queue correction event");
});
