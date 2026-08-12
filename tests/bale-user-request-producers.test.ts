import assert from "node:assert/strict";
import test from "node:test";

import { queueCourseApplicationEvent, queueSupportTicketEvent } from "../lib/bale-group-notifications";

test("an outbox insertion failure aborts the surrounding request transaction", async () => {
  const state = { transitioned: false, committed: false };
  const db = { $transaction: async (operation: (tx: any) => Promise<void>) => {
    const pending = { transitioned: false };
    await operation({
      supportTicket: { create: async () => { pending.transitioned = true; return { id: "ticket-1", subject: "ورود", userId: "user-1", user: { name: "علی" } }; } },
      baleGroupEvent: { upsert: async () => { throw new Error("OUTBOX_FAILED"); } },
    });
    state.transitioned = pending.transitioned;
    state.committed = true;
  } };

  await assert.rejects(db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create();
    await queueSupportTicketEvent(tx, ticket, new Date("2026-08-12T12:00:00.000Z"));
  }), /OUTBOX_FAILED/);
  assert.deepEqual(state, { transitioned: false, committed: false });
});

test("repeated course application submission keeps the first immutable event", async () => {
  const events = new Map<string, any>();
  const tx = { baleGroupEvent: { upsert: async (args: any) => {
    if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
    return events.get(args.where.eventKey);
  } } };
  const application = { id: "app-1", fullName: "مریم", userId: "user-1", course: { title: "تدوین" } };
  await queueCourseApplicationEvent(tx, application, new Date("2026-08-12T12:00:00.000Z"));
  await queueCourseApplicationEvent(tx, { ...application, fullName: "تغییر" }, new Date("2026-08-13T12:00:00.000Z"));
  assert.equal(events.size, 1);
  assert.equal(JSON.parse(events.get("course-application:app-1").payload).displayName, "مریم");
});
