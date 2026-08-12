import assert from "node:assert/strict";
import test from "node:test";

import { BaleApiError } from "../lib/bale-payment";
import { dispatchBaleGroupEvents } from "../scripts/dispatch-bale-group-events";
import { reconcileBaleReleaseEvents } from "../scripts/reconcile-bale-release-events";

type EventRow = {
  id: string;
  eventKey: string;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  sendStartedAt: Date | null;
  sentAt: Date | null;
  providerResponseId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const now = new Date("2026-08-12T12:00:00.000Z");
const paymentPayload = JSON.stringify({
  studentName: "علی رضایی",
  courseTitle: "کارگردانی",
  amountTomans: 1_250_000,
  method: "bale_wallet",
  orderNumber: "PAY-123",
  paidAt: "2026-08-12T11:00:00.000Z",
});

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: overrides.id ?? "event-1",
    eventKey: overrides.eventKey ?? "payment-paid:order-1",
    type: overrides.type ?? "payment_paid",
    payload: overrides.payload ?? paymentPayload,
    status: overrides.status ?? "pending",
    attempts: overrides.attempts ?? 0,
    nextAttemptAt: overrides.nextAttemptAt ?? new Date("2026-08-12T11:59:00.000Z"),
    claimedAt: overrides.claimedAt ?? null,
    sendStartedAt: overrides.sendStartedAt ?? null,
    sentAt: overrides.sentAt ?? null,
    providerResponseId: overrides.providerResponseId ?? null,
    lastError: overrides.lastError ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-08-12T11:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-08-12T11:00:00.000Z"),
  };
}

function matches(row: EventRow, where: Record<string, unknown>): boolean {
  if (Array.isArray(where.OR)) {
    return where.OR.some((condition: Record<string, unknown>) => matches(row, condition));
  }
  return Object.entries(where).every(([key, value]) => {
    const actual = row[key as keyof EventRow];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const condition = value as { in?: unknown[]; lte?: Date | number; lt?: Date | number };
      if (condition.in && !condition.in.includes(actual)) return false;
      if (condition.lte !== undefined && (actual as Date | number) > condition.lte) return false;
      if (condition.lt !== undefined && (actual as Date | number) >= condition.lt) return false;
      return true;
    }
    if (actual instanceof Date && value instanceof Date) return actual.getTime() === value.getTime();
    return actual === value;
  });
}

function database(initial: EventRow[] = []) {
  const rows = initial.map((row) => ({ ...row }));
  const stats = { queries: 0 };
  const baleGroupEvent = {
    findMany: async ({ where, take }: any) => {
      stats.queries += 1;
      return rows
        .filter((row) => !where || matches(row, where))
        .sort((left, right) => left.nextAttemptAt.getTime() - right.nextAttemptAt.getTime())
        .slice(0, take)
        .map((row) => ({ ...row }));
    },
    findUnique: async ({ where }: any) => rows.find((row) => matches(row, where)) ?? null,
    updateMany: async ({ where, data }: any) => {
      const candidates = rows.filter((row) => matches(row, where));
      for (const row of candidates) {
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in value) {
            (row as any)[key] += (value as { increment: number }).increment;
          } else {
            (row as any)[key] = value;
          }
        }
      }
      return { count: candidates.length };
    },
    upsert: async ({ where, create }: any) => {
      const existing = rows.find((row) => matches(row, where));
      if (existing) return existing;
      const created = event({
        ...create,
        id: `event-${rows.length + 1}`,
        status: "pending",
        attempts: 0,
        nextAttemptAt: create.nextAttemptAt ?? now,
        createdAt: now,
        updatedAt: now,
      });
      rows.push(created);
      return created;
    },
    create: async ({ data }: any) => {
      if (rows.some((row) => row.eventKey === data.eventKey)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      const created = event({ ...data, id: `event-${rows.length + 1}`, createdAt: now, updatedAt: now });
      rows.push(created);
      return created;
    },
  };
  const db = {
    baleGroupEvent,
    $transaction: async <T>(operation: (tx: { baleGroupEvent: typeof baleGroupEvent }) => Promise<T>) =>
      operation({ baleGroupEvent }),
  };
  return { db, rows, stats };
}

test("an atomic claim lets concurrent dispatchers send an event only once", async () => {
  const { db, rows } = database([event()]);
  let releaseSend!: () => void;
  const sending = new Promise<void>((resolve) => { releaseSend = resolve; });
  let sends = 0;
  const send = async () => { sends += 1; await sending; return { message_id: "provider-1" }; };

  const first = dispatchBaleGroupEvents(db as never, { chatId: "group-test", now, send });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await dispatchBaleGroupEvents(db as never, { chatId: "group-test", now, send });
  releaseSend();
  const firstResult = await first;

  assert.equal(sends, 1);
  assert.deepEqual(firstResult, { claimed: 1, sent: 1, retryable: 0, uncertain: 0, needsReview: 0 });
  assert.deepEqual(second, { claimed: 0, sent: 0, retryable: 0, uncertain: 0, needsReview: 0 });
  assert.equal(rows[0].attempts, 1);
});

test("successful delivery marks the event sent without persisting a provider identifier", async () => {
  const { db, rows } = database([event()]);
  const messages: string[] = [];

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async (_chatId, message) => { messages.push(message); return { message_id: "unsafe-provider-id" }; },
  });

  assert.equal(result.sent, 1);
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].sentAt?.toISOString(), now.toISOString());
  assert.equal(rows[0].providerResponseId, null);
  assert.match(messages[0], /پرداخت موفق/);
});

test("a definitive rejection schedules the next increasing retry", async () => {
  const { db, rows } = database([event({ attempts: 2 })]);

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => { throw new BaleApiError("provider 400 token=secret", "definitive_rejection"); },
  });

  assert.equal(result.retryable, 1);
  assert.equal(rows[0].status, "retryable");
  assert.equal(rows[0].attempts, 3);
  assert.equal(rows[0].nextAttemptAt.toISOString(), "2026-08-12T12:03:00.000Z");
  assert.equal(rows[0].lastError, "BALE_DEFINITIVE_REJECTION");
  assert.equal(rows[0].sendStartedAt, null);

  const retry = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now: new Date("2026-08-12T12:03:00.000Z"),
    send: async () => ({}),
  });
  assert.equal(retry.sent, 1);
  assert.equal(rows[0].attempts, 4);
});

test("the tenth definitive rejection requires review instead of another retry", async () => {
  const { db, rows } = database([event({ attempts: 9 })]);

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => { throw new BaleApiError("rejected", "definitive_rejection"); },
  });

  assert.equal(result.needsReview, 1);
  assert.equal(rows[0].status, "needs_review");
  assert.equal(rows[0].attempts, 10);
  assert.equal(rows[0].nextAttemptAt.toISOString(), "2026-08-12T11:59:00.000Z");
});

test("an uncertain send outcome is retained and never blindly retried", async () => {
  const { db, rows } = database([event()]);
  await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => { throw new BaleApiError("timeout token=secret", "delivery_uncertain"); },
  });
  await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now: new Date("2026-08-13T12:00:00.000Z"),
    send: async () => { throw new Error("must not send"); },
  });

  assert.equal(rows[0].status, "uncertain");
  assert.equal(rows[0].attempts, 1);
  assert.equal(rows[0].lastError, "BALE_DELIVERY_UNCERTAIN");
});

test("a malformed sendMessage success becomes uncertain and is never sent or retried", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.BALE_BOT_TOKEN;
  process.env.BALE_BOT_TOKEN = "bot-token";
  const { db, rows } = database([event()]);
  let sends = 0;
  global.fetch = (async () => {
    sends += 1;
    return new Response(JSON.stringify({ ok: true, result: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const first = await dispatchBaleGroupEvents(db as never, { chatId: "group-test", now });
    const repeated = await dispatchBaleGroupEvents(db as never, {
      chatId: "group-test",
      now: new Date("2026-08-13T12:00:00.000Z"),
    });

    assert.deepEqual(first, { claimed: 1, sent: 0, retryable: 0, uncertain: 1, needsReview: 0 });
    assert.deepEqual(repeated, { claimed: 0, sent: 0, retryable: 0, uncertain: 0, needsReview: 0 });
    assert.equal(sends, 1);
    assert.equal(rows[0].status, "uncertain");
    assert.equal(rows[0].sentAt, null);
    assert.equal(rows[0].attempts, 1);
    assert.equal(rows[0].lastError, "BALE_DELIVERY_UNCERTAIN");
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = originalToken;
  }
});

test("one event failure does not block the rest of the bounded batch", async () => {
  const { db, rows } = database([
    event({ id: "event-1", eventKey: "payment-paid:order-1" }),
    event({ id: "event-2", eventKey: "payment-paid:order-2" }),
    event({ id: "event-3", eventKey: "payment-paid:order-3" }),
  ]);
  let sends = 0;

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    batchSize: 2,
    send: async () => {
      sends += 1;
      if (sends === 1) throw new BaleApiError("rejected", "definitive_rejection");
      return {};
    },
  });

  assert.deepEqual(result, { claimed: 2, sent: 1, retryable: 1, uncertain: 0, needsReview: 0 });
  assert.equal(rows[0].status, "retryable");
  assert.equal(rows[1].status, "sent");
  assert.equal(rows[2].status, "pending");
});

test("stale claims retry only before send starts and otherwise become uncertain", async () => {
  const staleClaim = new Date("2026-08-12T11:54:00.000Z");
  const { db, rows } = database([
    event({ id: "recoverable", eventKey: "payment-paid:recoverable", status: "processing", claimedAt: staleClaim }),
    event({
      id: "unknown",
      eventKey: "payment-paid:unknown",
      status: "processing",
      claimedAt: staleClaim,
      sendStartedAt: new Date("2026-08-12T11:54:01.000Z"),
    }),
  ]);

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => ({}),
  });

  assert.equal(result.sent, 1);
  assert.equal(rows.find((row) => row.id === "recoverable")?.status, "sent");
  assert.equal(rows.find((row) => row.id === "unknown")?.status, "uncertain");
});

test("a stale post-send lease becomes uncertain without racing a live send", async () => {
  const { db, rows } = database([
    event({
      id: "stale-send",
      status: "processing",
      attempts: 1,
      claimedAt: new Date("2026-08-12T11:54:00.000Z"),
      sendStartedAt: new Date("2026-08-12T11:54:30.000Z"),
    }),
    event({
      id: "live-send",
      eventKey: "payment-paid:live",
      status: "processing",
      attempts: 1,
      claimedAt: new Date("2026-08-12T11:59:00.000Z"),
      sendStartedAt: new Date("2026-08-12T11:59:01.000Z"),
    }),
  ]);
  let sends = 0;

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => { sends += 1; return {}; },
  });

  assert.equal(result.uncertain, 1);
  assert.equal(sends, 0);
  assert.equal(rows[0].status, "uncertain");
  assert.equal(rows[0].lastError, "BALE_STALE_SEND_UNCERTAIN");
  assert.equal(rows[1].status, "processing");
});

test("pre-send claims do not consume attempts and attempt ten still sends", async () => {
  const { db, rows } = database([event({
    status: "processing",
    attempts: 9,
    claimedAt: new Date("2026-08-12T11:54:00.000Z"),
  })]);
  const originalUpdate = db.baleGroupEvent.updateMany;
  let updates = 0;
  db.baleGroupEvent.updateMany = async (args: any) => {
    updates += 1;
    if (updates === 2) return { count: 0 };
    return originalUpdate(args);
  };

  await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => ({}),
  });

  assert.equal(rows[0].attempts, 9);
  assert.equal(rows[0].status, "processing");

  db.baleGroupEvent.updateMany = originalUpdate;
  rows[0].claimedAt = new Date("2026-08-12T11:54:00.000Z");
  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => ({}),
  });

  assert.equal(result.sent, 1);
  assert.equal(rows[0].attempts, 10);
  assert.equal(rows[0].status, "sent");
});

test("missing coordination chat configuration neither claims nor burns attempts", async () => {
  const { db, rows } = database([event()]);
  let sends = 0;

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "",
    now,
    send: async () => { sends += 1; return {}; },
  });

  assert.deepEqual(result, { claimed: 0, sent: 0, retryable: 0, uncertain: 0, needsReview: 0 });
  assert.equal(sends, 0);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].attempts, 0);
});

test("missing bot token with the production sender performs no database work", async () => {
  const originalToken = process.env.BALE_BOT_TOKEN;
  delete process.env.BALE_BOT_TOKEN;
  const { db, rows, stats } = database([event()]);
  try {
    const result = await dispatchBaleGroupEvents(db as never, { chatId: "group-test", now });
    assert.deepEqual(result, { claimed: 0, sent: 0, retryable: 0, uncertain: 0, needsReview: 0 });
    assert.equal(stats.queries, 0);
    assert.equal(rows[0].attempts, 0);
    assert.equal(rows[0].status, "pending");
  } finally {
    if (originalToken === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = originalToken;
  }
});

test("invalid event payloads are quarantined without starting a send", async () => {
  const invalidRows = [
    event({ id: "wrong-type", type: "unknown" }),
    event({ id: "extra-field", eventKey: "payment-paid:extra", payload: JSON.stringify({ ...JSON.parse(paymentPayload), phone: "0912" }) }),
    event({ id: "bad-date", eventKey: "payment-paid:date", payload: JSON.stringify({ ...JSON.parse(paymentPayload), paidAt: "yesterday" }) }),
    event({ id: "impossible-date", eventKey: "payment-paid:impossible-date", payload: JSON.stringify({ ...JSON.parse(paymentPayload), paidAt: "2026-02-30T12:00:00.000Z" }) }),
    event({ id: "bad-method", eventKey: "payment-paid:method", payload: JSON.stringify({ ...JSON.parse(paymentPayload), method: "cash" }) }),
    event({ id: "unsafe-text", eventKey: "payment-paid:unsafe-text", payload: JSON.stringify({ ...JSON.parse(paymentPayload), studentName: "نام\n⚠️ جعلی" }) }),
    event({
      id: "large-release",
      eventKey: "release:large",
      type: "release",
      payload: JSON.stringify({ version: "2.2.0", title: "release", publishedAt: now.toISOString(), capabilities: Array(51).fill("capability") }),
    }),
  ];
  const { db, rows } = database(invalidRows);
  let sends = 0;

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    batchSize: 10,
    send: async () => { sends += 1; return {}; },
  });

  assert.equal(result.needsReview, invalidRows.length);
  assert.equal(sends, 0);
  for (const row of rows) {
    assert.equal(row.status, "needs_review");
    assert.equal(row.attempts, 0);
    assert.equal(row.sendStartedAt, null);
    assert.equal(row.lastError, "INVALID_EVENT_PAYLOAD");
  }
});

test("result counters include only final state transitions persisted by CAS", async () => {
  const { db, rows } = database([event()]);
  const originalUpdate = db.baleGroupEvent.updateMany;
  let updates = 0;
  db.baleGroupEvent.updateMany = async (args: any) => {
    updates += 1;
    if (updates === 3) return { count: 0 };
    return originalUpdate(args);
  };

  const result = await dispatchBaleGroupEvents(db as never, {
    chatId: "group-test",
    now,
    send: async () => ({}),
  });

  assert.equal(result.sent, 0);
  assert.equal(rows[0].status, "processing");
});

test("release reconciliation queues version 2.2 with exactly its 18 capability cards", async () => {
  const { db, rows } = database();

  const result = await reconcileBaleReleaseEvents(db as never, now);

  assert.deepEqual(result, { releases: 1, queued: 1 });
  const queued = rows.find((row) => row.eventKey === "release:version-2-2");
  assert.ok(queued);
  assert.equal(queued.type, "release");
  assert.deepEqual(JSON.parse(queued.payload), {
    version: "2.2.0",
    title: "انتشار نسخه ۲.۲ سامانه",
    publishedAt: "2026-08-12T11:51:01+03:30",
    capabilities: [
      "اطلاعات محلی استان‌ها و شهرها",
      "مدیریت و نمایش سرفصل دوره‌ها",
      "پرداخت پایدار با بله",
      "بهبود ایندکس و نمایش دوره‌ها در جستجو",
      "مسیر روشن ثبت‌نام در صفحه اصلی",
      "ثبت امن کارت پرداخت‌کننده",
      "سامان‌دهی فایل‌های کاربران و رسیدها",
      "گزارش‌های مدیریتی داشبورد",
      "تکمیل اطلاعات پس از ورود با گوگل",
      "ثبت‌نام چندمرحله‌ای",
      "سرعت و دسترس‌پذیری بهتر صفحه اصلی",
      "تغییر روش پرداخت",
      "مدیریت کامل کاربران و ثبت‌نام دستی",
      "سامانه تیکت پشتیبانی",
      "بررسی پروفایل و تصویر کاربران",
      "اعلان نتیجه ثبت‌نام دوره",
      "کدهای تخفیف مستقل",
      "وضعیت در انتظار بررسی درخواست‌ها",
    ],
  });
});

test("repeated release reconciliation keeps one immutable event per release", async () => {
  const { db, rows } = database();
  await reconcileBaleReleaseEvents(db as never, now);
  const originalPayload = rows[0].payload;
  const repeated = await reconcileBaleReleaseEvents(db as never, new Date("2026-08-13T12:00:00.000Z"));

  assert.deepEqual(repeated, { releases: 1, queued: 0 });
  assert.equal(rows.filter((row) => row.eventKey === "release:version-2-2").length, 1);
  assert.equal(rows[0].payload, originalPayload);
});

test("every release, including version 2.2, uses only the preceding release boundary", async () => {
  const { db, rows } = database();
  const notes = [
    { id: "version-2-2", title: "New", summary: "", publishedAt: "2026-08-12T12:00:00.000Z", version: "3.0.0", type: "release" as const },
    { id: "cap-new", title: "New capability", summary: "", publishedAt: "2026-08-11T12:00:00.000Z", type: "feature" as const },
    { id: "configurable-registration-forms", title: "Versioned capability", summary: "", publishedAt: "2026-08-10T12:00:00.000Z", version: "2.5.0", type: "feature" as const },
    { id: "cap-old", title: "Older capability", summary: "", publishedAt: "2026-08-09T12:00:00.000Z", type: "improvement" as const },
    { id: "release-old", title: "Old", summary: "", publishedAt: "2026-08-08T12:00:00.000Z", version: "2.0.0", type: "release" as const },
  ];

  await reconcileBaleReleaseEvents(db as never, now, { notes, appVersion: "3.0.0" });

  assert.deepEqual(JSON.parse(rows[0].payload).capabilities, [
    "New capability",
    "Versioned capability",
    "Older capability",
  ]);
});

test("concurrent release reconciliation reports only the durable unique winner", async () => {
  const { db, rows } = database();
  let releaseFirst!: () => void;
  const firstWaiting = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const originalCreate = db.baleGroupEvent.create;
  let creates = 0;
  db.baleGroupEvent.create = async (args: any) => {
    creates += 1;
    if (creates === 1) await firstWaiting;
    else releaseFirst();
    return originalCreate(args);
  };

  const [first, second] = await Promise.all([
    reconcileBaleReleaseEvents(db as never, now),
    reconcileBaleReleaseEvents(db as never, now),
  ]);

  assert.equal(first.queued + second.queued, 1);
  assert.equal(rows.filter((row) => row.eventKey === "release:version-2-2").length, 1);
});
