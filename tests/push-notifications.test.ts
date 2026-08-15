import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminApplicationPush,
  buildAdminPaymentPush,
  buildReleasePush,
  notifyAdminsPush,
  notifyAllSubscribedUsersPush,
} from "../lib/push-notifications";

test("buildAdminApplicationPush builds a Persian push payload with course and student", () => {
  const content = buildAdminApplicationPush({
    fullName: "علی محمدی",
    course: { title: "کارگردانی سینما" },
  });
  assert.equal(content.title, "درخواست ثبت‌نام جدید");
  assert.equal(content.body, "«کارگردانی سینما» — علی محمدی");
  assert.equal(content.url, "/admin/applications");
});

test("buildAdminApplicationPush tolerates missing course and student", () => {
  const content = buildAdminApplicationPush({});
  assert.equal(content.body, "«» — ");
});

test("buildAdminPaymentPush builds a Persian push payload with order number", () => {
  const content = buildAdminPaymentPush(
    { orderNumber: "PAY-123" },
    { fullName: "سارا احمدی", course: { title: "بازیگری" } },
  );
  assert.equal(content.title, "سفارش پرداخت جدید");
  assert.equal(content.body, "«بازیگری» — سارا احمدی — PAY-123");
  assert.equal(content.url, "/admin/payments");
});

test("buildReleasePush builds a Persian release push payload", () => {
  const content = buildReleasePush({ version: "2.3.0", title: "نسخه جدید منتشر شد" });
  assert.equal(content.body, "نسخه 2.3.0 منتشر شد");
  assert.equal(content.url, "/");
});

test("notifyAdminsPush sends to all admins and passes the payload through", async () => {
  const sent: Array<{ userIds: string[]; title: string; body?: string; url?: string }> = [];
  const result = await notifyAdminsPush(
    { title: "ت", body: "ب", url: "/u" },
    {
      findAdmins: async () => [{ id: "a1" }, { id: "a2" }],
      send: async (options) => {
        sent.push(options);
        return { total: 2, sent: 2, expired: 0, failed: 0 };
      },
    },
  );
  assert.equal(result.sent, 2);
  assert.deepEqual(sent[0].userIds, ["a1", "a2"]);
  assert.equal(sent[0].title, "ت");
  assert.equal(sent[0].body, "ب");
  assert.equal(sent[0].url, "/u");
});

test("notifyAdminsPush short-circuits when there are no admins", async () => {
  let sendCalled = false;
  const result = await notifyAdminsPush(
    { title: "ت", body: "ب", url: "/u" },
    {
      findAdmins: async () => [],
      send: async () => {
        sendCalled = true;
        return { total: 0, sent: 0, expired: 0, failed: 0 };
      },
    },
  );
  assert.deepEqual(result, { total: 0, sent: 0, expired: 0, failed: 0 });
  assert.equal(sendCalled, false);
});

test("notifyAllSubscribedUsersPush sends to all subscribed user ids", async () => {
  const sent: Array<{ userIds: string[] }> = [];
  const result = await notifyAllSubscribedUsersPush(
    { title: "ت", body: "ب", url: "/" },
    {
      findSubscribedUserIds: async () => ["u1", "u2", "u3"],
      send: async (options) => {
        sent.push(options);
        return { total: 3, sent: 3, expired: 0, failed: 0 };
      },
    },
  );
  assert.equal(result.sent, 3);
  assert.deepEqual(sent[0].userIds, ["u1", "u2", "u3"]);
});

test("notifyAllSubscribedUsersPush short-circuits when nobody is subscribed", async () => {
  let sendCalled = false;
  const result = await notifyAllSubscribedUsersPush(
    { title: "ت", body: "ب", url: "/" },
    {
      findSubscribedUserIds: async () => [],
      send: async () => {
        sendCalled = true;
        return { total: 0, sent: 0, expired: 0, failed: 0 };
      },
    },
  );
  assert.deepEqual(result, { total: 0, sent: 0, expired: 0, failed: 0 });
  assert.equal(sendCalled, false);
});
