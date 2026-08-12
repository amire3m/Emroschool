import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { PATCH as reviewPayment } from "../app/api/admin/payments/[id]/route";
import { POST as createManualPayment } from "../app/api/admin/payments/manual/route";
import { finalizeBalePayment } from "../lib/bale-payment-finalization";
import {
  canClaimBaleGroupEvent,
  formatBaleGroupEvent,
  paymentDuplicateEventKey,
  paymentPaidEventKey,
  queueAvatarReviewEvent,
  queueCourseApplicationEvent,
  queuePaymentReceiptEvent,
  queueProfileReviewEvent,
  queueSupportTicketEvent,
  queueSupportUserMessageEvent,
  queuePaidPaymentEvent,
  retryAt,
  retryBaleGroupEvent,
} from "../lib/bale-group-notifications";

const payload = {
  studentName: "علی رضایی",
  courseTitle: "کارگردانی",
  amountTomans: 1_250_000,
  method: "bale_wallet",
  orderNumber: "PAY-123",
  paidAt: "2026-08-12T12:00:00.000Z",
};

test("formats safe successful and duplicate payment messages", () => {
  const paid = formatBaleGroupEvent({ type: "payment_paid", payload });
  const duplicate = formatBaleGroupEvent({ type: "payment_duplicate", payload });
  assert.match(paid, /پرداخت موفق/);
  assert.match(paid, /علی رضایی/);
  assert.match(paid, /۱٬۲۵۰٬۰۰۰ تومان/);
  assert.match(paid, /کیف پول بله/);
  assert.match(paid, /تاریخ پرداخت: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰/);
  assert.match(duplicate, /پرداخت تکراری/);
  assert.doesNotMatch(paid + duplicate, /phone|card|payload|tracking|token/i);
});

test("formats a safe Persian release publication date", () => {
  const message = formatBaleGroupEvent({
    type: "release",
    payload: {
      version: "2.2.0",
      title: "انتشار نسخه ۲.۲ سامانه",
      publishedAt: "2026-08-12T11:51:01+03:30",
      capabilities: ["قابلیت امن"],
    },
  });

  assert.match(message, /تاریخ انتشار: ۲۱ مرداد ۱۴۰۵، ۱۱:۵۱/);
  assert.doesNotMatch(message, /2026|publishedAt/);
});

test("formats operational request cards with only labeled safe fields", () => {
  const cases = [
    {
      event: { type: "support_ticket" as const, payload: { displayName: "علی رضایی", subject: "مشکل ورود", submittedAt: "2026-08-12T12:00:00.000Z", ticketId: "ticket-1", userId: "user-1" } },
      expected: "🎫 تیکت پشتیبانی جدید\nدسته: پشتیبانی\nنام: علی رضایی\nموضوع: مشکل ورود\nزمان: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰",
    },
    {
      event: { type: "support_user_message" as const, payload: { displayName: "علی رضایی", subject: "مشکل ورود", submittedAt: "2026-08-12T12:00:00.000Z", ticketId: "ticket-1", messageId: "message-1", userId: "user-1" } },
      expected: "💬 پاسخ جدید هنرجو\nدسته: پشتیبانی\nنام: علی رضایی\nموضوع: مشکل ورود\nزمان: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰",
    },
    {
      event: { type: "course_application" as const, payload: { displayName: "مریم احمدی", courseTitle: "تدوین", submittedAt: "2026-08-12T12:00:00.000Z", applicationId: "app-1", userId: "user-2" } },
      expected: "📝 درخواست ثبت‌نام دوره\nدسته: ثبت‌نام\nنام: مریم احمدی\nدوره: تدوین\nزمان: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰",
    },
    {
      event: { type: "payment_receipt" as const, payload: { displayName: "زهرا محمدی", courseTitle: "کارگردانی", orderNumber: "PAY-1", submittedAt: "2026-08-12T12:00:00.000Z", orderId: "order-1", userId: "user-3" } },
      expected: "🧾 رسید پرداخت جدید\nدسته: پرداخت\nنام: زهرا محمدی\nدوره: کارگردانی\nشماره سفارش: PAY-1\nزمان: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰",
    },
    {
      event: { type: "profile_review" as const, payload: { displayName: "رضا کریمی", submittedAt: "2026-08-12T12:00:00.000Z", userId: "user-4" } },
      expected: "👤 بازبینی پروفایل\nدسته: پروفایل\nنام: رضا کریمی\nزمان: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰",
    },
    {
      event: { type: "avatar_review" as const, payload: { displayName: "سارا اکبری", submittedAt: "2026-08-12T12:00:00.000Z", submissionId: "avatar-1", userId: "user-5" } },
      expected: "🖼️ بازبینی تصویر پروفایل\nدسته: تصویر پروفایل\nنام: سارا اکبری\nزمان: ۲۱ مرداد ۱۴۰۵، ۱۵:۳۰",
    },
  ];
  for (const item of cases) assert.equal(formatBaleGroupEvent(item.event), item.expected);

  const serialized = cases.map((item) => formatBaleGroupEvent(item.event)).join("\n");
  assert.doesNotMatch(serialized, /متن محرمانه|0912|example@|0013546789|خیابان|custom response|uploads|receipt|card|token/i);
});

test("queues one immutable safe event for every durable request submission", async () => {
  const events = new Map<string, any>();
  const tx = { baleGroupEvent: { upsert: async (args: any) => {
    if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
    return events.get(args.where.eventKey);
  } } };
  const submittedAt = new Date("2026-08-12T12:00:00.000Z");
  await queueSupportTicketEvent(tx, { id: "ticket-1", subject: "ورود", userId: "user-1", user: { name: "علی" } }, submittedAt);
  await queueSupportUserMessageEvent(tx, { id: "message-1", ticketId: "ticket-1", authorId: "user-1", ticket: { subject: "ورود", userId: "user-1" }, author: { name: "علی", role: "user" } }, submittedAt);
  await queueSupportUserMessageEvent(tx, { id: "admin-message", ticketId: "ticket-1", authorId: "admin-1", ticket: { subject: "ورود", userId: "user-1" }, author: { name: "مدیر", role: "admin" } }, submittedAt);
  await queueCourseApplicationEvent(tx, { id: "app-1", fullName: "مریم", userId: "user-2", course: { title: "تدوین" } }, submittedAt);
  await queuePaymentReceiptEvent(tx, { id: "order-1", orderNumber: "PAY-1", userId: "user-3", user: { name: "زهرا" }, course: { title: "کارگردانی" } }, "receipt-revision-1", submittedAt);
  await queueProfileReviewEvent(tx, { id: "user-4", name: "رضا" }, "profile-revision-1", submittedAt);
  await queueAvatarReviewEvent(tx, { id: "avatar-1", userId: "user-5", user: { name: "سارا" } }, submittedAt);
  await queuePaymentReceiptEvent(tx, { id: "order-1", orderNumber: "CHANGED", userId: "user-3", user: { name: "changed" }, course: { title: "changed" } }, "receipt-revision-1", new Date());

  assert.deepEqual([...events.keys()], [
    "support-ticket:ticket-1", "support-user-message:message-1", "course-application:app-1",
    "payment-receipt:order-1:receipt-revision-1", "profile-review:user-4:profile-revision-1", "avatar-review:avatar-1",
  ]);
  assert.equal(JSON.parse(events.get("payment-receipt:order-1:receipt-revision-1").payload).orderNumber, "PAY-1");
  assert.doesNotMatch(JSON.stringify([...events.values()]), /0912|example@|national|address|customResponses|receiptUrl|payerCard|token/i);
});

test("builds stable event keys and increasing retry times", () => {
  assert.equal(paymentPaidEventKey("order-1"), "payment-paid:order-1");
  assert.equal(paymentDuplicateEventKey("attempt-2"), "payment-duplicate:attempt-2");
  const now = new Date("2026-08-12T12:00:00.000Z");
  assert.equal(retryAt(now, 1).toISOString(), "2026-08-12T12:01:00.000Z");
  assert.equal(retryAt(now, 3).toISOString(), "2026-08-12T12:03:00.000Z");
});

test("stops retrying after the tenth failed attempt", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");
  assert.deepEqual(retryBaleGroupEvent(now, 9), {
    status: "retryable",
    nextAttemptAt: new Date("2026-08-12T12:09:00.000Z"),
  });
  assert.deepEqual(retryBaleGroupEvent(now, 10), {
    status: "needs_review",
    nextAttemptAt: null,
  });
});

test("claims only due work or a stale pre-send processing lease", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");
  const staleBefore = new Date("2026-08-12T11:55:00.000Z");
  assert.equal(canClaimBaleGroupEvent({
    status: "retryable",
    attempts: 2,
    nextAttemptAt: new Date("2026-08-12T12:00:00.000Z"),
    claimedAt: null,
    sendStartedAt: null,
  }, now, staleBefore), true);
  assert.equal(canClaimBaleGroupEvent({
    status: "retryable",
    attempts: 2,
    nextAttemptAt: new Date("2026-08-12T12:00:01.000Z"),
    claimedAt: null,
    sendStartedAt: null,
  }, now, staleBefore), false);
  assert.equal(canClaimBaleGroupEvent({
    status: "processing",
    attempts: 2,
    nextAttemptAt: new Date("2026-08-12T11:00:00.000Z"),
    claimedAt: new Date("2026-08-12T11:54:59.000Z"),
    sendStartedAt: null,
  }, now, staleBefore), true);
  assert.equal(canClaimBaleGroupEvent({
    status: "processing",
    attempts: 2,
    nextAttemptAt: new Date("2026-08-12T11:00:00.000Z"),
    claimedAt: new Date("2026-08-12T11:54:59.000Z"),
    sendStartedAt: new Date("2026-08-12T11:55:01.000Z"),
  }, now, staleBefore), false);
  assert.equal(canClaimBaleGroupEvent({
    status: "retryable",
    attempts: 10,
    nextAttemptAt: new Date("2026-08-12T11:00:00.000Z"),
    claimedAt: null,
    sendStartedAt: null,
  }, now, staleBefore), false);
});

test("queues one immutable event snapshot for repeated requests", async () => {
  const events = new Map<string, unknown>();
  const tx = {
    baleGroupEvent: {
      upsert: async (args: any) => {
        if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
        return events.get(args.where.eventKey);
      },
    },
  };
  const order = {
    id: "order-1",
    orderNumber: payload.orderNumber,
    amountTomans: payload.amountTomans,
    method: payload.method,
    user: { name: payload.studentName },
    course: { title: payload.courseTitle },
    phone: "09120000000",
    payerCardEncrypted: "secret-card",
    balePayload: "secret-provider-payload",
  };
  await queuePaidPaymentEvent(tx, order, new Date(payload.paidAt));
  await queuePaidPaymentEvent(tx, order, new Date(payload.paidAt));
  assert.equal(events.size, 1);
  assert.deepEqual(events.get("payment-paid:order-1"), {
    eventKey: "payment-paid:order-1",
    type: "payment_paid",
    payload: JSON.stringify(payload),
  });
  const serialized = JSON.stringify(events.get("payment-paid:order-1"));
  assert.doesNotMatch(serialized, /09120000000|secret-card|secret-provider-payload/);
});

test("Bale finalization rejects a missing outbox delegate before changing payment state", async () => {
  const state = {
    attemptUpdates: 0,
    orderUpdates: 0,
    enrollments: 0,
    applicationUpdates: 0,
  };
  const order = {
    id: "order-no-outbox",
    orderNumber: "PAY-NO-OUTBOX",
    amountTomans: 400_000,
    method: "bale_wallet",
    status: "pending",
    activeAttemptId: "attempt-no-outbox",
    applicationId: "application-no-outbox",
    userId: "user-no-outbox",
    courseId: "course-no-outbox",
    user: { name: "هنرجو" },
    course: { title: "دوره" },
    application: { fullName: "هنرجو" },
  };
  const tx = {
    paymentAttempt: {
      findUnique: async () => ({
        id: "attempt-no-outbox",
        orderId: order.id,
        method: "bale_wallet",
        status: "pending",
        amountRials: 4_000_000,
        balePayload: "payload-no-outbox",
        balePaymentId: null,
        baleTrackingNumber: null,
        order,
      }),
      findMany: async () => [],
      update: async () => undefined,
      updateMany: async () => { state.attemptUpdates += 1; return { count: 1 }; },
    },
    paymentOrder: { update: async () => { state.orderUpdates += 1; } },
    courseApplication: { update: async () => { state.applicationUpdates += 1; } },
    enrollment: { upsert: async () => { state.enrollments += 1; } },
  };

  await assert.rejects(finalizeBalePayment(tx as never, {
    attemptId: "attempt-no-outbox",
    invoicePayload: "payload-no-outbox",
    currency: "IRR",
    totalAmount: 4_000_000,
    balePaymentId: "payment-no-outbox",
    baleTrackingNumber: "tracking-no-outbox",
  }), /BALE_GROUP_EVENT_DELEGATE_REQUIRED/);
  assert.deepEqual(state, {
    attemptUpdates: 0,
    orderUpdates: 0,
    enrollments: 0,
    applicationUpdates: 0,
  });
});

test("Bale finalization queues only the first paid transition and each distinct duplicate charge", async () => {
  const order = {
    id: "order-wallet",
    orderNumber: "PAY-WALLET",
    amountTomans: 400_000,
    method: "bale_wallet",
    status: "pending",
    activeAttemptId: "attempt-first",
    applicationId: "application-wallet",
    userId: "user-wallet",
    courseId: "course-wallet",
    user: { name: "علی رضایی" },
    course: { title: "کارگردانی" },
    application: { fullName: "نام فرم" },
  };
  const attempts = [
    {
      id: "attempt-first",
      orderId: order.id,
      method: "bale_wallet",
      status: "pending",
      amountRials: 4_000_000,
      balePayload: "payload-first",
      balePaymentId: null as string | null,
      baleTrackingNumber: null as string | null,
    },
    {
      id: "attempt-duplicate",
      orderId: order.id,
      method: "bale_wallet",
      status: "pending",
      amountRials: 4_000_000,
      balePayload: "payload-duplicate",
      balePaymentId: null as string | null,
      baleTrackingNumber: null as string | null,
    },
  ];
  const events = new Map<string, unknown>();
  const tx = {
    paymentAttempt: {
      findUnique: async ({ where }: any) => {
        const attempt = attempts.find((item) => item.id === where.id);
        return attempt ? { ...attempt, order } : null;
      },
      findMany: async ({ where }: any) => attempts.filter((attempt) => where.OR.some((condition: any) =>
        (condition.balePaymentId && attempt.balePaymentId === condition.balePaymentId) ||
        (condition.baleTrackingNumber && attempt.baleTrackingNumber === condition.baleTrackingNumber),
      )),
      update: async () => undefined,
      updateMany: async ({ where, data }: any) => {
        const attempt = attempts.find((item) => item.id === where.id && item.orderId === where.orderId);
        if (!attempt) return { count: 0 };
        Object.assign(attempt, data);
        return { count: 1 };
      },
    },
    paymentOrder: { update: async ({ data }: any) => Object.assign(order, data) },
    courseApplication: { update: async () => undefined },
    enrollment: { upsert: async () => undefined },
    baleGroupEvent: {
      upsert: async (args: any) => {
        if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
        return events.get(args.where.eventKey);
      },
    },
  };
  const payment = {
    currency: "IRR",
    totalAmount: 4_000_000,
    paidAt: new Date("2026-08-12T12:00:00.000Z"),
  };

  assert.equal(await finalizeBalePayment(tx, {
    ...payment,
    attemptId: "attempt-first",
    invoicePayload: "payload-first",
    balePaymentId: "payment-first",
    baleTrackingNumber: "tracking-first",
  }), "paid");
  assert.equal(await finalizeBalePayment(tx, {
    ...payment,
    attemptId: "attempt-first",
    invoicePayload: "payload-first",
    balePaymentId: "payment-first",
    baleTrackingNumber: "tracking-first",
  }), "already_paid");
  assert.equal(await finalizeBalePayment(tx, {
    ...payment,
    attemptId: "attempt-duplicate",
    invoicePayload: "payload-duplicate",
    balePaymentId: "payment-duplicate",
    baleTrackingNumber: "tracking-duplicate",
  }), "paid_duplicate");
  assert.equal(await finalizeBalePayment(tx, {
    ...payment,
    attemptId: "attempt-duplicate",
    invoicePayload: "payload-duplicate",
    balePaymentId: "payment-duplicate",
    baleTrackingNumber: "tracking-duplicate",
  }), "already_paid");

  assert.deepEqual([...events.keys()], [
    "payment-paid:order-wallet",
    "payment-duplicate:attempt-duplicate",
  ]);
});

test("card approval queues a safe paid event once in the payment transaction", async () => {
  const events = new Map<string, unknown>();
  const order = {
    id: "order-card",
    orderNumber: "PAY-CARD",
    amountTomans: 800_000,
    method: "card_to_card",
    status: "under_review",
    activeAttemptId: "attempt-card",
    applicationId: "application-card",
    userId: "user-card",
    courseId: "course-card",
    user: { name: "مریم احمدی" },
    course: { title: "تدوین" },
    application: { fullName: "نام فرم" },
  };
  const db = {
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback({
      paymentOrder: {
        findUnique: async () => order,
        update: async ({ data }: any) => Object.assign(order, data),
      },
      paymentAttempt: { update: async () => undefined },
      courseApplication: { update: async () => undefined },
      enrollment: { upsert: async () => undefined },
      baleGroupEvent: {
        upsert: async (args: any) => {
          if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
          return events.get(args.where.eventKey);
        },
      },
    }),
  };
  const request = new NextRequest("http://localhost/api/admin/payments/order-card", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });

  const response = await reviewPayment(request, { params: { id: order.id } }, {
    db,
    authorize: async () => ({ id: "admin-1" }),
    now: () => new Date("2026-08-12T13:00:00.000Z"),
  } as any);

  assert.equal(response.status, 200);
  const repeated = await reviewPayment(new NextRequest(request.url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  }), { params: { id: order.id } }, {
    db,
    authorize: async () => ({ id: "admin-1" }),
  } as any);
  assert.equal(repeated.status, 409);
  assert.equal(events.size, 1);
  const queued = events.get("payment-paid:order-card") as { payload: string };
  assert.deepEqual(JSON.parse(queued.payload), {
    studentName: "مریم احمدی",
    courseTitle: "تدوین",
    amountTomans: 800_000,
    method: "card_to_card",
    orderNumber: "PAY-CARD",
    paidAt: "2026-08-12T13:00:00.000Z",
  });
});

test("manual paid creation queues one safe event once in the creation transaction", async () => {
  const events = new Map<string, unknown>();
  const application = {
    id: "application-manual",
    status: "pending_payment",
    fullName: "زهرا محمدی",
    userId: "user-manual",
    courseId: "course-manual",
    finalAmountTomans: 600_000,
    user: { name: null },
    course: { title: "فیلم‌نامه‌نویسی" },
    paymentOrder: null,
  };
  const created = {
    id: "order-manual",
    orderNumber: "MAN-TEST",
    amountTomans: application.finalAmountTomans,
    method: "manual",
  };
  const db = {
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback({
      courseApplication: {
        findUnique: async () => application,
        update: async ({ data }: any) => Object.assign(application, data),
      },
      paymentOrder: {
        create: async () => {
          application.paymentOrder = { id: created.id } as never;
          return created;
        },
      },
      enrollment: { upsert: async () => undefined },
      baleGroupEvent: {
        upsert: async (args: any) => {
          if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
          return events.get(args.where.eventKey);
        },
      },
    }),
  };
  const request = new NextRequest("http://localhost/api/admin/payments/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId: application.id }),
  });

  const response = await createManualPayment(request, {}, {
    db,
    authorize: async () => ({ id: "admin-1" }),
    now: () => new Date("2026-08-12T14:00:00.000Z"),
    orderNumber: () => "MAN-TEST",
  } as any);

  assert.equal(response.status, 201);
  const repeated = await createManualPayment(new NextRequest(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId: application.id }),
  }), {}, {
    db,
    authorize: async () => ({ id: "admin-1" }),
  } as any);
  assert.equal(repeated.status, 409);
  assert.equal(events.size, 1);
  const queued = events.get("payment-paid:order-manual") as { payload: string };
  assert.equal(JSON.parse(queued.payload).studentName, "زهرا محمدی");
});
