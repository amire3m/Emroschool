import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

import { PATCH as reviewPayment } from "../app/api/admin/payments/[id]/route";
import { PATCH as updateApplication } from "../app/api/course-applications/[id]/route";
import { generateToken } from "../lib/auth";
import { applyCardPaymentReview, hasActiveEnrollmentGrant } from "../lib/payment-review";
import { backfillEnrollmentGrants } from "../scripts/backfill-enrollment-grants";

const execFileAsync = promisify(execFile);

test("reopens a rejected card receipt for review without user resubmission", async () => {
  const order = {
    id: "order-card",
    method: "card_to_card",
    status: "rejected",
    reviewVersion: 1,
    receiptUrl: "/receipts/original.webp",
    receiptSubmissionRevision: 1,
    activeAttemptId: "attempt-card",
    applicationId: "application-card",
    userId: "user-card",
    courseId: "course-card",
    user: { name: "Student" },
    course: { title: "Course" },
    application: { fullName: "Student" },
  };
  const decisions: unknown[] = [];
  const db = {
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback({
      paymentOrder: {
        findUnique: async () => ({ ...order }),
        updateMany: async ({ where, data }: any) => {
          if (where.reviewVersion !== order.reviewVersion) return { count: 0 };
          Object.assign(order, data, { reviewVersion: order.reviewVersion + 1 });
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({ ...order }),
      },
      paymentAttempt: {
        updateMany: async ({ where, data }: any) => {
          assert.deepEqual(where, { id: "attempt-card", orderId: "order-card" });
          assert.equal(data.status, "under_review");
          return { count: 1 };
        },
      },
      paymentReviewDecision: { create: async ({ data }: any) => decisions.push(data) },
      enrollmentGrant: { upsert: async () => undefined },
      courseApplication: { update: async () => undefined },
    }),
  };
  const response = await reviewPayment(new NextRequest("http://test/api/admin/payments/order-card", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reopen_rejection", reason: "Rejected by mistake", expectedReviewVersion: 1 }),
  }), { params: { id: order.id } }, {
    db,
    authorize: async () => ({ id: "admin-1" }),
    now: () => new Date("2026-08-13T08:00:00.000Z"),
  } as never);

  assert.equal(response.status, 200);
  assert.equal(order.status, "under_review");
  assert.equal(order.receiptUrl, "/receipts/original.webp");
  assert.equal(order.receiptSubmissionRevision, 1);
  assert.equal(decisions.length, 1);
});

function reviewTransaction(order: any, options: { extraGrant?: boolean } = {}) {
  const attempts = [{ id: order.activeAttemptId, orderId: order.id, status: order.status, receiptUrl: order.receiptUrl }];
  const decisions: any[] = [];
  const grants: any[] = options.extraGrant ? [{ sourceType: "free_checkout", sourceId: "application-free", userId: order.userId, courseId: order.courseId, active: true }] : [];
  const enrollment = { userId: order.userId, courseId: order.courseId, progress: 73, completed: false };
  const tx = {
    paymentOrder: {
      updateMany: async ({ where, data }: any) => {
        if (where.id !== order.id || where.reviewVersion !== order.reviewVersion || where.status !== order.status) return { count: 0 };
        Object.assign(order, data, { reviewVersion: order.reviewVersion + 1, ...(data.status ? { status: data.status } : {}) });
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...order }),
    },
    paymentAttempt: {
      updateMany: async ({ where, data }: any) => {
        const attempt = attempts.find((item) => item.id === where.id && item.orderId === where.orderId);
        if (!attempt) return { count: 0 };
        Object.assign(attempt, data);
        return { count: 1 };
      },
    },
    paymentReviewDecision: { create: async ({ data }: any) => decisions.push({ ...data }) },
    enrollment: { upsert: async () => enrollment },
    enrollmentGrant: {
      upsert: async ({ where, update, create }: any) => {
        const existing = grants.find((grant) => grant.sourceType === where.sourceType_sourceId.sourceType && grant.sourceId === where.sourceType_sourceId.sourceId);
        if (existing) return Object.assign(existing, update);
        grants.push({ ...create, active: true, revokedAt: null });
        return grants.at(-1);
      },
      updateMany: async ({ where, data }: any) => {
        const matches = grants.filter((grant) => grant.sourceType === where.sourceType && grant.sourceId === where.sourceId && grant.active === where.active);
        matches.forEach((grant) => Object.assign(grant, data));
        return { count: matches.length };
      },
      count: async ({ where }: any) => grants.filter((grant) => grant.userId === where.userId && grant.courseId === where.courseId && grant.active === where.active).length,
    },
    courseApplication: { update: async () => undefined },
  };
  return { tx, attempts, decisions, grants, enrollment };
}

test("rejects corrections without a reason and stale review versions", async () => {
  const paidOrder = { id: "order-1", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1" };
  const fixture = reviewTransaction(paidOrder);
  await assert.rejects(() => applyCardPaymentReview(fixture.tx, { order: paidOrder, reviewerId: "admin", action: "reverse_approval", reason: "", expectedReviewVersion: 1, now: new Date() }), /REASON_REQUIRED/);
  await assert.rejects(() => applyCardPaymentReview(fixture.tx, { order: paidOrder, reviewerId: "admin", action: "reverse_approval", reason: "mistake", expectedReviewVersion: 0, now: new Date() }), /STALE_REVIEW_VERSION/);
  assert.equal(fixture.decisions.length, 0);
});

test("reversal preserves financial evidence and progress, and reapproval restores only its deterministic grant", async () => {
  const paidAt = new Date("2026-08-12T10:00:00.000Z");
  const order = { id: "order-1", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt, receiptUrl: "/receipt.webp", receiptSubmissionRevision: 2, activeAttemptId: "attempt-1", applicationId: "application-1", userId: "user-1", courseId: "course-1" };
  const fixture = reviewTransaction(order, { extraGrant: true });
  fixture.grants.push({ sourceType: "payment_card", sourceId: order.id, userId: order.userId, courseId: order.courseId, active: true });

  await applyCardPaymentReview(fixture.tx, { order, reviewerId: "admin", action: "reverse_approval", reason: "wrong receipt", expectedReviewVersion: 1, now: new Date("2026-08-13T08:00:00.000Z") });
  assert.equal(order.status, "review_reopened");
  assert.equal(order.paidAt, paidAt);
  assert.equal(order.receiptUrl, "/receipt.webp");
  assert.equal(order.receiptSubmissionRevision, 2);
  assert.equal(fixture.enrollment.progress, 73);
  assert.equal(fixture.grants.find((grant) => grant.sourceType === "payment_card")?.active, false);
  assert.equal(await hasActiveEnrollmentGrant(fixture.tx, order.userId, order.courseId), true);

  await applyCardPaymentReview(fixture.tx, { order, reviewerId: "admin", action: "approve", reason: "", expectedReviewVersion: 2, now: new Date("2026-08-13T09:00:00.000Z") });
  assert.equal(fixture.grants.find((grant) => grant.sourceType === "payment_card")?.active, true);
  assert.deepEqual(fixture.decisions.map((decision) => decision.action), ["reverse_approval", "approve"]);
});

test("final rejection after reversal appends history and leaves the payment grant inactive", async () => {
  const order = { id: "order-1", method: "card_to_card", status: "paid", reviewVersion: 1, paidAt: new Date(), receiptUrl: "/receipt.webp", activeAttemptId: "attempt-1", applicationId: null, userId: "user-1", courseId: "course-1" };
  const fixture = reviewTransaction(order);
  fixture.grants.push({ sourceType: "payment_card", sourceId: order.id, userId: order.userId, courseId: order.courseId, active: true });
  await applyCardPaymentReview(fixture.tx, { order, reviewerId: "admin", action: "reverse_approval", reason: "wrong", expectedReviewVersion: 1, now: new Date() });
  await applyCardPaymentReview(fixture.tx, { order, reviewerId: "admin", action: "reject", reason: "invalid", expectedReviewVersion: 2, now: new Date() });
  assert.equal(order.status, "rejected");
  assert.equal(fixture.grants[0].active, false);
  assert.deepEqual(fixture.decisions.map((decision) => decision.reviewVersion), [2, 3]);
});

test("direct application transitions cannot bypass review for a paid card order", async () => {
  const application = { id: "application-1", status: "approved", userId: "user-1", courseId: "course-1", paymentOrder: { id: "order-1", method: "card_to_card", status: "paid" } };
  const db = {
    courseApplication: { findUnique: async () => application },
    $transaction: async () => { throw new Error("transaction must not start"); },
  };
  const adminToken = generateToken({ id: "admin", email: "admin@example.com", role: "superadmin" });
  const response = await updateApplication(new NextRequest("http://test/api/course-applications/application-1", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "rejected" }),
  }), { params: { id: application.id } }, { db, authorize: async () => ({ id: "admin", role: "superadmin" }) } as never);
  assert.equal(response.status, 409);

  const unchanged = await updateApplication(new NextRequest("http://test/api/course-applications/application-1", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "approved" }),
  }), { params: { id: application.id } }, { db, authorize: async () => ({ id: "admin", role: "superadmin" }) } as never);
  assert.equal(unchanged.status, 200);
});

test("real SQLite backfill creates exactly one active legacy grant per existing enrollment", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "enrollment-grants-"));
  const databasePath = path.join(directory, "integration.db");
  const databaseUrl = `file:${databasePath.replace(/\\/g, "/")}`;
  const schemaPath = path.join(directory, "schema.prisma");
  const schema = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  await writeFile(schemaPath, schema.replace('url      = "file:./dev.db"', 'url      = "file:./integration.db"'));
  await execFileAsync(process.execPath, [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "db", "push", "--schema", schemaPath, "--skip-generate"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl } });
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await db.user.create({ data: { id: "user-legacy", email: "legacy@example.com", name: "Legacy", password: "x" } });
    await db.user.create({ data: { id: "admin-cas", email: "admin-cas@example.com", name: "Admin", password: "x", role: "admin" } });
    await db.course.create({ data: { id: "course-legacy", title: "Legacy", slug: "legacy", description: "test" } });
    const enrollment = await db.enrollment.create({ data: { id: "enrollment-legacy", userId: "user-legacy", courseId: "course-legacy", progress: 41 } });
    assert.deepEqual(await backfillEnrollmentGrants(db), { grantsCreated: 1 });
    assert.deepEqual(await backfillEnrollmentGrants(db), { grantsCreated: 0 });
    const grants = await (db as any).enrollmentGrant.findMany();
    assert.deepEqual(grants.map(({ sourceType, sourceId, userId, courseId, active }: any) => ({ sourceType, sourceId, userId, courseId, active })), [{ sourceType: "legacy", sourceId: enrollment.id, userId: "user-legacy", courseId: "course-legacy", active: true }]);
    assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).progress, 41);

    const order = await db.paymentOrder.create({ data: { id: "order-cas", orderNumber: "PAY-CAS", amountTomans: 100, amountRials: 1000, method: "card_to_card", status: "under_review", receiptUrl: "/receipt.webp", userId: "user-legacy", courseId: "course-legacy" } });
    const attempt = await db.paymentAttempt.create({ data: { id: "attempt-cas", orderId: order.id, sequence: 1, method: "card_to_card", status: "under_review", amountTomans: 100, amountRials: 1000, receiptUrl: "/receipt.webp" } });
    await db.paymentOrder.update({ where: { id: order.id }, data: { activeAttemptId: attempt.id } });
    await db.$transaction(async (tx) => applyCardPaymentReview(tx, { order: { ...order, activeAttemptId: attempt.id }, reviewerId: "admin-cas", action: "approve", reason: "", expectedReviewVersion: 0, now: new Date("2026-08-13T10:00:00.000Z") }));
    await assert.rejects(() => db.$transaction(async (tx) => applyCardPaymentReview(tx, { order: { ...order, activeAttemptId: attempt.id }, reviewerId: "admin-cas", action: "reject", reason: "late", expectedReviewVersion: 0, now: new Date("2026-08-13T10:01:00.000Z") })), /STALE_REVIEW_VERSION/);
    assert.equal((await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).reviewVersion, 1);
    assert.equal(await (db as any).paymentReviewDecision.count({ where: { orderId: order.id } }), 1);
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
