import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as createTicket } from "../app/api/support/tickets/route";
import { POST as replyTicket } from "../app/api/support/tickets/[id]/route";
import { POST as createApplication } from "../app/api/course-applications/route";
import { POST as submitReceipt } from "../app/api/payments/[id]/receipt/route";
import { PUT as updateProfile } from "../app/api/user/profile/route";
import { POST as submitAvatar } from "../app/api/user/avatar/route";
import { generateToken } from "../lib/auth";

const user = { id: "user-1", name: "علی رضایی", email: "ali@example.test", role: "user", permissions: null };
const token = generateToken(user);
const auth = { Authorization: `Bearer ${token}` };

function outbox(fail = false) {
  const events = new Map<string, any>();
  return { events, delegate: { upsert: async (args: any) => {
    if (fail) throw new Error("OUTBOX_FAILED");
    if (!events.has(args.where.eventKey)) events.set(args.where.eventKey, args.create);
    return events.get(args.where.eventKey);
  } } };
}

test("ticket creation route inserts one event and rolls back when outbox fails", async () => {
  for (const fail of [false, true]) {
    const box = outbox(fail);
    let committed = false;
    const db = { $transaction: async (operation: any) => {
      const tx = {
        supportTicket: {
          create: async () => ({ id: "ticket-1", subject: "ورود", userId: user.id, user: { name: user.name }, createdAt: new Date("2026-08-12T12:00:00Z") }),
          findUniqueOrThrow: async () => ({ id: "ticket-1", messages: [] }),
        },
        supportMessage: { create: async () => ({ id: "message-1" }) }, baleGroupEvent: box.delegate,
      };
      const result = await operation(tx); committed = true; return result;
    } };
    const response = await createTicket(new NextRequest("http://test/api/support/tickets", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ subject: "ورود", message: "متن محرمانه" }) }), {}, { db, authenticate: async () => user } as never);
    assert.equal(response.status, fail ? 500 : 201);
    assert.equal(committed, !fail);
    assert.equal(box.events.size, fail ? 0 : 1);
  }
});

test("support reply route queues user messages once and excludes admin authors", async () => {
  for (const role of ["user", "admin"]) {
    const actor = { ...user, id: role === "user" ? user.id : "admin-1", role };
    const box = outbox();
    const db = {
      supportTicket: { findFirst: async () => ({ id: "ticket-1", status: "waiting_for_user" }) },
      $transaction: async (operation: any) => operation({
        supportTicket: { update: async () => ({ id: "ticket-1" }) },
        supportMessage: { create: async () => ({ id: `message-${role}`, ticketId: "ticket-1", authorId: actor.id, createdAt: new Date("2026-08-12T12:00:00Z"), author: { name: actor.name, role }, ticket: { subject: "ورود", userId: actor.id } }) },
        baleGroupEvent: box.delegate,
      }),
    };
    const response = await replyTicket(new NextRequest("http://test/api/support/tickets/ticket-1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "secret" }) }), { params: { id: "ticket-1" } }, { db, authenticate: async () => actor } as never);
    assert.equal(response.status, 200);
    assert.equal(box.events.size, role === "user" ? 1 : 0);
  }
});

test("transient lock maps to conflict only after authoritative revision changed", async () => {
  const locked = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  const profileState: any = { ...user, password: "x", bio: null, profileReviewRevision: 0, notificationSmsEnabled: true, notificationBaleEnabled: false, phone: "0912" };
  let concurrentWinner = true;
  const profileDb = { user: { findUnique: async () => ({ ...profileState }) }, $transaction: async () => { if (concurrentWinner) profileState.profileReviewRevision = 1; throw locked; } };
  const response = await updateProfile(new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "new" }) }), {}, { db: profileDb, authenticate: () => ({ id: user.id }) } as never);
  assert.equal(response.status, 409);
  profileState.profileReviewRevision = 0; concurrentWinner = false;
  const unchanged = await updateProfile(new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "new" }) }), {}, { db: profileDb, authenticate: () => ({ id: user.id }) } as never);
  assert.equal(unchanged.status, 500);

  const order: any = { id: "order-lock", userId: user.id, method: "card_to_card", status: "awaiting_receipt", receiptSubmissionRevision: 0 };
  let transactionRan = false;
  const receiptDb = { paymentOrder: { findFirst: async () => transactionRan ? { receiptSubmissionRevision: 1, status: "under_review" } : ({ ...order }) }, $transaction: async () => { transactionRan = true; throw locked; } };
  const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "receipt.png", { type: "image/png" }));
  const receipt = await submitReceipt(new NextRequest("http://test/api/payments/order-lock/receipt", { method: "POST", headers: auth, body: form }), { params: { id: order.id } }, { db: receiptDb, mkdir: async () => undefined, writeFile: async () => undefined, randomUUID: () => "file", onError: () => undefined });
  assert.equal(receipt.status, 409);
});

test("connection timeouts do not masquerade as concurrent request conflicts", async () => {
  for (const code of ["P1008", "P2024"]) {
    const timeout = Object.assign(new Error("Timed out fetching a new connection from the connection pool"), { code });
    const profileState: any = { ...user, password: "x", bio: null, profileReviewRevision: 0, notificationSmsEnabled: true, notificationBaleEnabled: false, phone: "0912" };
    let profileRead = false;
    const profileDb = {
      user: { findUnique: async () => profileRead ? { profileReviewRevision: 1 } : ({ ...profileState }) },
      $transaction: async () => { profileRead = true; throw timeout; },
    };
    const profile = await updateProfile(new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "new" }) }), {}, { db: profileDb, authenticate: () => ({ id: user.id }) } as never);
    assert.equal(profile.status, 500);

    const order: any = { id: `order-${code}`, userId: user.id, method: "card_to_card", status: "awaiting_receipt", receiptSubmissionRevision: 0 };
    let receiptRead = false;
    const receiptDb = {
      paymentOrder: { findFirst: async () => receiptRead ? { receiptSubmissionRevision: 1, status: "under_review" } : ({ ...order }) },
      $transaction: async () => { receiptRead = true; throw timeout; },
    };
    const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "receipt.png", { type: "image/png" }));
    const receipt = await submitReceipt(new NextRequest(`http://test/api/payments/${order.id}/receipt`, { method: "POST", headers: auth, body: form }), { params: { id: order.id } }, { db: receiptDb, mkdir: async () => undefined, writeFile: async () => undefined, randomUUID: () => "file", onError: () => undefined });
    assert.equal(receipt.status, 500);
  }
});

test("course application route queues one immutable pending event", async () => {
  const box = outbox();
  const course = { id: "course-1", title: "تدوین", published: true, scheduleStatus: "upcoming", price: 800_000, registrationFormOverride: null };
  const existingUser = { ...user, phone: "09121234567", nationalCode: "1000000001" };
  const application = { id: "app-1", fullName: "علی رضایی", userId: user.id, course: { title: course.title }, status: "pending", finalAmountTomans: 800_000, createdAt: new Date("2026-08-12T12:00:00Z") };
  let existingApplication: typeof application | null = null;
  const db = {
    course: { findUnique: async () => course }, courseApplication: { findUnique: async () => existingApplication }, registrationForm: { findUnique: async () => null }, user: { findUnique: async () => existingUser },
    $transaction: async (operation: any) => operation({ user: { update: async () => existingUser }, courseApplication: { create: async () => { existingApplication = application; return application; } }, baleGroupEvent: box.delegate }),
  };
  const body = { courseId: course.id, fullName: "علی رضایی", email: user.email, phone: "09121234567", nationalCode: "1000000001", birthDate: "1380/01/01", gender: "male", province: "قم", city: "قم", address: "آدرس", educationLevel: "کارشناسی", educationField: "هنر", university: "دانشگاه", universityField: "هنر", reason: "یادگیری", workHistory: "ندارد", artHistory: "ندارد", instagramId: "ali", virtualPhone: "09121234567", customResponses: {} };
  const response = await createApplication(new NextRequest("http://test/api/course-applications", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) }), {}, { db, ensureDiscounts: async () => undefined, findDiscount: async () => null, notify: async () => undefined } as never);
  assert.equal(response.status, 201);
  assert.equal(box.events.size, 1);
  assert.equal(JSON.parse([...box.events.values()][0].payload).reviewState, "pending");
  const repeated = await createApplication(new NextRequest("http://test/api/course-applications", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) }), {}, { db, ensureDiscounts: async () => undefined, findDiscount: async () => null, notify: async () => undefined } as never);
  assert.equal(repeated.status, 200); assert.equal(box.events.size, 1);

  const failedBox = outbox(true); let committed = false;
  existingApplication = null;
  const failingDb = { ...db, $transaction: async (operation: any) => {
    const result = await operation({ user: { update: async () => existingUser }, courseApplication: { create: async () => application }, baleGroupEvent: failedBox.delegate }); committed = true; return result;
  } };
  const failed = await createApplication(new NextRequest("http://test/api/course-applications", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) }), {}, { db: failingDb, ensureDiscounts: async () => undefined, findDiscount: async () => null, notify: async () => undefined } as never);
  assert.equal(failed.status, 500); assert.equal(committed, false);
});

function receiptRequest() {
  const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "receipt.png", { type: "image/png" }));
  return new NextRequest("http://test/api/payments/order-1/receipt", { method: "POST", headers: auth, body: form });
}

test("receipt route uses CAS revisions and a concurrent stale writer conflicts", async () => {
  const box = outbox();
  const order: any = { id: "order-1", orderNumber: "PAY-1", amountTomans: 800_000, userId: user.id, method: "card_to_card", status: "awaiting_receipt", activeAttemptId: "attempt-1", receiptSubmissionRevision: 0, user: { name: user.name }, course: { title: "تدوین" } };
  const db = {
    paymentOrder: { findFirst: async () => ({ ...order }) },
    $transaction: async (operation: any) => operation({
      paymentOrder: {
        findUnique: async () => ({ ...order }),
        updateMany: async ({ where, data }: any) => {
          if (where.receiptSubmissionRevision !== order.receiptSubmissionRevision || !where.status.in.includes(order.status)) return { count: 0 };
          Object.assign(order, { status: "under_review", receiptSubmissionRevision: order.receiptSubmissionRevision + data.receiptSubmissionRevision.increment }); return { count: 1 };
        },
        findUniqueOrThrow: async () => ({ ...order }),
      },
      paymentAttempt: { findFirst: async () => null }, baleGroupEvent: box.delegate,
    }),
  };
  const overrides = { db, mkdir: async () => undefined, writeFile: async () => undefined, randomUUID: () => "file-id", now: () => new Date("2026-08-12T12:00:00Z"), onError: () => undefined };
  const [first, second] = await Promise.all([submitReceipt(receiptRequest(), { params: { id: order.id } }, overrides), submitReceipt(receiptRequest(), { params: { id: order.id } }, overrides)]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.deepEqual([...box.events.keys()], ["payment-receipt:order-1:1"]);
});

test("profile route increments one durable revision and concurrent identical request conflicts", async () => {
  const box = outbox();
  const state: any = { ...user, password: "hash", name: "علی رضایی", profileReviewRevision: 0, profileApprovalStatus: "approved", notificationSmsEnabled: true, notificationBaleEnabled: false, notificationEmailEnabled: true, newsletterSubscribed: false, phone: "0912", balePhone: null };
  const db = {
    user: { findUnique: async () => ({ ...state }), update: async ({ data }: any) => Object.assign(state, data) },
    $transaction: async (operation: any) => operation({ user: {
      updateMany: async ({ where, data }: any) => { if (where.profileReviewRevision !== state.profileReviewRevision) return { count: 0 }; Object.assign(state, data, { profileReviewRevision: state.profileReviewRevision + 1 }); return { count: 1 }; },
      findUniqueOrThrow: async () => ({ ...state }),
    }, baleGroupEvent: box.delegate }),
  };
  const request = () => new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "معرفی جدید" }) });
  const overrides = { db, authenticate: () => ({ id: user.id }), now: () => new Date("2026-08-12T12:00:00Z") };
  const [first, second] = await Promise.all([updateProfile(request(), {}, overrides as never), updateProfile(request(), {}, overrides as never)]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.deepEqual([...box.events.keys()], ["profile-review:user-1:1"]);
  const preferences = await updateProfile(new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newsletterSubscribed: true }) }), {}, overrides as never);
  assert.equal(preferences.status, 200); assert.equal(box.events.size, 1);
});

test("avatar route queues one event and outbox failure prevents transaction commit", async () => {
  const box = outbox(true); let committed = false;
  const db = { user: { findUnique: async () => ({ id: user.id }) }, $transaction: async (operation: any) => {
    const result = await operation({ avatarSubmission: { updateMany: async () => ({ count: 0 }), create: async () => ({ id: "avatar-1", userId: user.id, imageUrl: "/safe", submittedAt: new Date(), user: { name: user.name } }) }, baleGroupEvent: box.delegate }); committed = true; return result;
  } };
  const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "avatar.png", { type: "image/png" }));
  const response = await submitAvatar(new NextRequest("http://test/api/user/avatar", { method: "POST", body: form }), {}, { db, authenticate: () => ({ id: user.id }), mkdir: async () => undefined, writeFile: async () => undefined, fileName: () => "avatar.png" } as never);
  assert.equal(response.status, 500); assert.equal(committed, false);
});

test("avatar route successfully commits one event", async () => {
  const box = outbox(); let committed = false;
  const db = { user: { findUnique: async () => ({ id: user.id }) }, $transaction: async (operation: any) => {
    const result = await operation({ avatarSubmission: { updateMany: async () => ({ count: 0 }), create: async () => ({ id: "avatar-ok", userId: user.id, imageUrl: "/safe", submittedAt: new Date("2026-08-12T12:00:00.000Z"), user: { name: user.name } }) }, baleGroupEvent: box.delegate }); committed = true; return result;
  } };
  const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "avatar.png", { type: "image/png" }));
  const response = await submitAvatar(new NextRequest("http://test/api/user/avatar", { method: "POST", body: form }), {}, { db, authenticate: () => ({ id: user.id }), mkdir: async () => undefined, writeFile: async () => undefined, fileName: () => "avatar.png" } as never);
  assert.equal(response.status, 200); assert.equal(committed, true); assert.deepEqual([...box.events.keys()], ["avatar-review:avatar-ok"]);
});

test("support reply outbox failure prevents transaction commit", async () => {
  const box = outbox(true); let committed = false;
  const db = { supportTicket: { findFirst: async () => ({ id: "ticket-1", status: "waiting_for_user" }) }, $transaction: async (operation: any) => {
    const result = await operation({ supportTicket: { update: async () => ({ id: "ticket-1" }) }, supportMessage: { create: async () => ({ id: "message-fail", ticketId: "ticket-1", authorId: user.id, createdAt: new Date(), author: { name: user.name, role: "user" }, ticket: { subject: "ورود", userId: user.id } }) }, baleGroupEvent: box.delegate }); committed = true; return result;
  } };
  const response = await replyTicket(new NextRequest("http://test/api/support/tickets/ticket-1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "secret" }) }), { params: { id: "ticket-1" } }, { db, authenticate: async () => user } as never);
  assert.equal(response.status, 500); assert.equal(committed, false);
});

test("receipt and profile outbox failures do not commit authoritative revisions", async () => {
  const box = outbox(true);
  const order: any = { id: "order-fail", orderNumber: "PAY-F", amountTomans: 800_000, userId: user.id, method: "card_to_card", status: "awaiting_receipt", activeAttemptId: null, receiptSubmissionRevision: 0, user: { name: user.name }, course: { title: "تدوین" } };
  const receiptDb = { paymentOrder: { findFirst: async () => ({ ...order }) }, $transaction: async (operation: any) => operation({ paymentOrder: { findUnique: async () => ({ ...order }), updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ ...order, receiptSubmissionRevision: 1 }) }, paymentAttempt: { findFirst: async () => null }, baleGroupEvent: box.delegate }) };
  const form = new FormData(); form.set("file", new File([new Uint8Array([1])], "receipt.png", { type: "image/png" }));
  const receipt = await submitReceipt(new NextRequest("http://test/api/payments/order-fail/receipt", { method: "POST", headers: auth, body: form }), { params: { id: order.id } }, { db: receiptDb, mkdir: async () => undefined, writeFile: async () => undefined, randomUUID: () => "file", onError: () => undefined });
  assert.equal(receipt.status, 500); assert.equal(order.receiptSubmissionRevision, 0);

  const state: any = { ...user, password: "x", bio: null, profileReviewRevision: 0, notificationSmsEnabled: true, notificationBaleEnabled: false, phone: "0912" };
  const profileDb = { user: { findUnique: async () => ({ ...state }) }, $transaction: async (operation: any) => operation({ user: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ ...state, profileReviewRevision: 1 }) }, baleGroupEvent: box.delegate }) };
  const profile = await updateProfile(new NextRequest("http://test/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio: "new" }) }), {}, { db: profileDb, authenticate: () => ({ id: user.id }) } as never);
  assert.equal(profile.status, 500); assert.equal(state.profileReviewRevision, 0);
});
