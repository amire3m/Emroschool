import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { PUT as updateProfile } from "../app/api/user/profile/route";
import { POST as submitReceipt } from "../app/api/payments/[id]/receipt/route";
import { generateToken } from "../lib/auth";

const execFileAsync = promisify(execFile);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function withDeferredTransaction(db: PrismaClient) {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      return async (operation: (tx: PrismaClient) => Promise<unknown>) => {
        await db.$executeRawUnsafe("BEGIN DEFERRED");
        try {
          const result = await operation(db);
          await db.$executeRawUnsafe("COMMIT");
          return result;
        } catch (error) {
          await db.$executeRawUnsafe("ROLLBACK").catch(() => undefined);
          throw error;
        }
      };
    },
  });
}

test("real SQLite stale snapshots hit retryable lock recovery before authoritative 409", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bale-request-cas-"));
  const databaseUrl = `file:${path.join(directory, "integration.db").replace(/\\/g, "/")}`;
  const schemaPath = path.join(directory, "schema.prisma");
  const schema = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  await writeFile(schemaPath, schema.replace('url      = "file:./dev.db"', 'url      = "file:./integration.db"'));
  await execFileAsync(process.execPath, [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "db", "push", "--schema", schemaPath, "--skip-generate", "--accept-data-loss"]);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const winnerDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const loserDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
    const user = await db.user.create({ data: { id: "user-cas", email: "cas@example.test", name: "CAS", password: "x", notificationSmsEnabled: true } });
    const category = await db.category.create({ data: { id: "cat-cas", name: "CAS", slug: "cas" } });
    const course = await db.course.create({ data: { id: "course-cas", title: "CAS", slug: "course-cas", description: "test", price: 800_000, categoryId: category.id } });
    const order = await db.paymentOrder.create({ data: { id: "order-cas", orderNumber: "PAY-CAS", amountTomans: 800_000, amountRials: 8_000_000, method: "card_to_card", status: "awaiting_receipt", userId: user.id, courseId: course.id } });
    const profileRequest = () => new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "new bio" }) });
    const profileRead = deferred(); const releaseProfile = deferred(); const profileErrors: unknown[] = [];
    const profileLoser = updateProfile(profileRequest(), {}, { db: withDeferredTransaction(loserDb), authenticate: () => ({ id: user.id }), now: () => new Date("2026-08-12T12:00:00.000Z"), afterRevisionRead: async (tx: typeof loserDb) => { await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { profileReviewRevision: true } }); profileRead.resolve(); await releaseProfile.promise; }, onConcurrencyError: (error: unknown) => profileErrors.push(error) } as never);
    await profileRead.promise;
    const profileWinner = await updateProfile(profileRequest(), {}, { db: winnerDb, authenticate: () => ({ id: user.id }), now: () => new Date("2026-08-12T12:00:00.000Z") } as never);
    releaseProfile.resolve(); const profileLoserResponse = await profileLoser;
    assert.equal(profileErrors.length, 1);
    assert.match(String((profileErrors[0] as { code?: unknown }).code) + String(profileErrors[0]), /P1008|P2024|P2034|SQLITE_BUSY|SQLITE_LOCKED|database .*locked/i);
    assert.deepEqual([profileWinner.status, profileLoserResponse.status], [200, 409]);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).profileReviewRevision, 1);
    assert.equal(await db.baleGroupEvent.count({ where: { eventKey: "profile-review:user-cas:1" } }), 1);

    const token = generateToken({ id: user.id, email: user.email, role: "user" });
    const receiptRequest = () => { const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "receipt.png", { type: "image/png" })); return new NextRequest("http://test/api/payments/order-cas/receipt", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }); };
    const overrides = { db, mkdir: async () => undefined, writeFile: async () => undefined, randomUUID: () => "file", now: () => new Date("2026-08-12T12:00:00.000Z"), onError: () => undefined };
    const receiptRead = deferred(); const releaseReceipt = deferred(); const receiptErrors: unknown[] = [];
    const receiptLoser = submitReceipt(receiptRequest(), { params: { id: order.id } }, { ...overrides, db: withDeferredTransaction(loserDb), afterRevisionRead: async () => { receiptRead.resolve(); await releaseReceipt.promise; }, onConcurrencyError: (error: unknown) => receiptErrors.push(error) } as never);
    await receiptRead.promise;
    const receiptWinner = await submitReceipt(receiptRequest(), { params: { id: order.id } }, { ...overrides, db: winnerDb });
    releaseReceipt.resolve(); const receiptLoserResponse = await receiptLoser;
    assert.equal(receiptErrors.length, 1);
    assert.match(String((receiptErrors[0] as { code?: unknown }).code) + String(receiptErrors[0]), /P1008|P2024|P2034|SQLITE_BUSY|SQLITE_LOCKED|database .*locked/i);
    assert.deepEqual([receiptWinner.status, receiptLoserResponse.status], [200, 409]);
    assert.equal((await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).receiptSubmissionRevision, 1);
    assert.equal(await db.baleGroupEvent.count({ where: { eventKey: "payment-receipt:order-cas:1" } }), 1);
  } finally { await Promise.all([db.$disconnect(), winnerDb.$disconnect(), loserDb.$disconnect()]); await rm(directory, { recursive: true, force: true }); }
});
