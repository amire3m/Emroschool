import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

import { backfillLegacyBalePayments } from "../scripts/backfill-bale-payment-attempts";
import { finalizeBalePayment } from "../lib/bale-payment-finalization";

const execFileAsync = promisify(execFile);

test("real SQLite backfill expires legacy pending attempts and paid finalization beats expiration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bale-payment-"));
  const databasePath = path.join(directory, "integration.db");
  const databaseUrl = `file:${databasePath.replace(/\\/g, "/")}`;
  const schemaPath = path.join(directory, "schema.prisma");
  const schema = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  await writeFile(schemaPath, schema.replace('url      = "file:./dev.db"', 'url      = "file:./integration.db"'));
  await execFileAsync(process.execPath, [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "db", "push", "--schema", schemaPath, "--skip-generate", "--accept-data-loss"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const user = await db.user.create({ data: { id: "user-i", email: "i@example.com", name: "I", password: "x" } });
    const category = await db.category.create({ data: { id: "category-i", name: "Integration", slug: "integration" } });
    const course = await db.course.create({ data: { id: "course-i", title: "Course", slug: "course-i", description: "test", price: 400_000, categoryId: category.id } });
    const order = await db.paymentOrder.create({ data: { id: "order-i", orderNumber: "PAY-I", amountTomans: 400_000, amountRials: 4_000_000, method: "bale_wallet", status: "pending", balePayload: "payload-i", userId: user.id, courseId: course.id } });
    const attempt = await db.paymentAttempt.create({ data: { id: "attempt-i", orderId: order.id, sequence: 1, method: "bale_wallet", status: "pending", amountTomans: 400_000, amountRials: 4_000_000, balePayload: "attempt-payload-i", createdAt: new Date("2026-08-10T12:00:00.000Z") } });
    await db.paymentAttempt.create({ data: { id: "attempt-evidence-i", orderId: order.id, sequence: 2, method: "bale_wallet", status: "pending", amountTomans: 400_000, amountRials: 4_000_000, balePayload: "evidence-payload-i", balePaymentId: "evidence-payment-i", baleTrackingNumber: "evidence-tracking-i", baleVerificationStatus: "received", createdAt: new Date("2026-08-10T11:00:00.000Z") } });
    await db.paymentAttempt.create({ data: { id: "attempt-paid-i", orderId: order.id, sequence: 3, method: "bale_wallet", status: "paid", amountTomans: 400_000, amountRials: 4_000_000, balePayload: "paid-payload-i", balePaymentId: "paid-payment-i", baleTrackingNumber: "paid-tracking-i", baleVerificationStatus: "successful_payment", createdAt: new Date("2026-08-10T10:00:00.000Z"), paidAt: new Date("2026-08-10T10:05:00.000Z") } });
    await db.paymentOrder.update({ where: { id: order.id }, data: { activeAttemptId: attempt.id } });

    const result = await backfillLegacyBalePayments(db, new Date("2026-08-10T12:16:00.000Z"));
    const expired = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const evidence = await db.paymentAttempt.findUniqueOrThrow({ where: { id: "attempt-evidence-i" } });
    const alreadyPaid = await db.paymentAttempt.findUniqueOrThrow({ where: { id: "attempt-paid-i" } });
    assert.deepEqual(result, { deadlinesBackfilled: 3, attemptsExpired: 2, ordersNormalized: 1 });
    assert.equal(expired.expiresAt?.toISOString(), "2026-08-10T12:15:00.000Z");
    assert.equal(expired.status, "expired");
    assert.equal(evidence.status, "expired");
    assert.equal(evidence.balePaymentId, "evidence-payment-i");
    assert.equal(evidence.baleTrackingNumber, "evidence-tracking-i");
    assert.equal(alreadyPaid.status, "paid");

    const finalized = await db.$transaction((tx) => finalizeBalePayment(tx as any, {
      attemptId: attempt.id,
      invoicePayload: "attempt-payload-i",
      currency: "IRR",
      totalAmount: 4_000_000,
      balePaymentId: "payment-i",
      baleTrackingNumber: "tracking-i",
      paidAt: new Date("2026-08-10T12:17:00.000Z"),
    }));
    assert.equal(finalized, "paid");
    assert.equal((await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "paid");
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
