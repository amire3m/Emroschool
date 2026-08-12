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

test("real SQLite CAS commits one profile and receipt revision under contention", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bale-request-cas-"));
  const databaseUrl = `file:${path.join(directory, "integration.db").replace(/\\/g, "/")}`;
  const schemaPath = path.join(directory, "schema.prisma");
  const schema = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  await writeFile(schemaPath, schema.replace('url      = "file:./dev.db"', 'url      = "file:./integration.db"'));
  await execFileAsync(process.execPath, [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "db", "push", "--schema", schemaPath, "--skip-generate", "--accept-data-loss"]);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const user = await db.user.create({ data: { id: "user-cas", email: "cas@example.test", name: "CAS", password: "x", notificationSmsEnabled: true } });
    const category = await db.category.create({ data: { id: "cat-cas", name: "CAS", slug: "cas" } });
    const course = await db.course.create({ data: { id: "course-cas", title: "CAS", slug: "course-cas", description: "test", price: 800_000, categoryId: category.id } });
    const order = await db.paymentOrder.create({ data: { id: "order-cas", orderNumber: "PAY-CAS", amountTomans: 800_000, amountRials: 8_000_000, method: "card_to_card", status: "awaiting_receipt", userId: user.id, courseId: course.id } });
    const profileRequest = () => new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "new bio" }) });
    const profiles = await Promise.all([updateProfile(profileRequest(), {}, { db, authenticate: () => ({ id: user.id }), now: () => new Date("2026-08-12T12:00:00.000Z") } as never), updateProfile(profileRequest(), {}, { db, authenticate: () => ({ id: user.id }), now: () => new Date("2026-08-12T12:00:00.000Z") } as never)]);
    assert.deepEqual(profiles.map((item) => item.status).sort(), [200, 409]);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).profileReviewRevision, 1);
    assert.equal(await db.baleGroupEvent.count({ where: { eventKey: "profile-review:user-cas:1" } }), 1);

    const token = generateToken({ id: user.id, email: user.email, role: "user" });
    const receiptRequest = () => { const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "receipt.png", { type: "image/png" })); return new NextRequest("http://test/api/payments/order-cas/receipt", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }); };
    const overrides = { db, mkdir: async () => undefined, writeFile: async () => undefined, randomUUID: () => "file", now: () => new Date("2026-08-12T12:00:00.000Z"), onError: () => undefined };
    const receipts = await Promise.all([submitReceipt(receiptRequest(), { params: { id: order.id } }, overrides), submitReceipt(receiptRequest(), { params: { id: order.id } }, overrides)]);
    assert.deepEqual(receipts.map((item) => item.status).sort(), [200, 409]);
    assert.equal((await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).receiptSubmissionRevision, 1);
    assert.equal(await db.baleGroupEvent.count({ where: { eventKey: "payment-receipt:order-cas:1" } }), 1);
  } finally { await db.$disconnect(); await rm(directory, { recursive: true, force: true }); }
});
