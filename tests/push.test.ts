import assert from "node:assert/strict";
import test from "node:test";

import {
  isExpiredSubscriptionError,
  parsePushSubscriptionInput,
  registerPushSubscription,
  sendPushToUsers,
  unregisterPushSubscription,
  type PushSubscriptionRecord,
  type PushSender,
} from "../lib/push";

test("parsePushSubscriptionInput accepts a valid https subscription", () => {
  const parsed = parsePushSubscriptionInput({
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
    userAgent: "Mozilla/5.0",
  });
  assert.deepEqual(parsed, {
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
    userAgent: "Mozilla/5.0",
  });
});

test("parsePushSubscriptionInput accepts a localhost http endpoint for local development", () => {
  const parsed = parsePushSubscriptionInput({
    endpoint: "http://localhost:3000/push",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
  });
  assert.ok(parsed);
  assert.equal(parsed!.endpoint, "http://localhost:3000/push");
});

test("parsePushSubscriptionInput rejects non-localhost http endpoints", () => {
  assert.equal(
    parsePushSubscriptionInput({
      endpoint: "http://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }),
    null,
  );
});

test("parsePushSubscriptionInput rejects missing or malformed fields", () => {
  assert.equal(parsePushSubscriptionInput(null), null);
  assert.equal(parsePushSubscriptionInput("x"), null);
  assert.equal(parsePushSubscriptionInput({ endpoint: 5, keys: { p256dh: "a", auth: "b" } }), null);
  assert.equal(parsePushSubscriptionInput({ endpoint: "https://push.example.com/a" }), null);
  assert.equal(
    parsePushSubscriptionInput({
      endpoint: "https://push.example.com/a",
      keys: { p256dh: "", auth: "b" },
    }),
    null,
  );
  assert.equal(
    parsePushSubscriptionInput({
      endpoint: "not-a-url",
      keys: { p256dh: "a", auth: "b" },
    }),
    null,
  );
  assert.equal(
    parsePushSubscriptionInput({
      endpoint: "ftp://push.example.com/a",
      keys: { p256dh: "a", auth: "b" },
    }),
    null,
  );
});

test("isExpiredSubscriptionError detects 404 and 410 statuses only", () => {
  assert.equal(isExpiredSubscriptionError({ statusCode: 404 }), true);
  assert.equal(isExpiredSubscriptionError({ statusCode: 410 }), true);
  assert.equal(isExpiredSubscriptionError({ statusCode: 500 }), false);
  assert.equal(isExpiredSubscriptionError(new Error("boom")), false);
  assert.equal(isExpiredSubscriptionError(null), false);
});

test("sendPushToUsers sends one push per subscription and reports sent counts", async () => {
  const sent: Array<{ endpoint: string; title: string; body?: string; url?: string; ttl: number }> = [];
  const sender: PushSender = {
    async send(subscription, payload, ttlSeconds) {
      sent.push({ endpoint: subscription.endpoint, title: payload.title, body: payload.body, url: payload.url, ttl: ttlSeconds });
    },
  };
  const subscriptions: PushSubscriptionRecord[] = [
    { id: "s1", endpoint: "https://push.example.com/1", keys: JSON.stringify({ p256dh: "a", auth: "b" }), userId: "u1" },
    { id: "s2", endpoint: "https://push.example.com/2", keys: JSON.stringify({ p256dh: "c", auth: "d" }), userId: "u2" },
  ];
  const result = await sendPushToUsers({
    userIds: ["u1", "u2"],
    title: "تست",
    body: "بدن",
    url: "/courses/x",
    ttlSeconds: 60,
    sender,
    findSubscriptions: async () => subscriptions,
    deleteSubscription: async () => {},
  });
  assert.deepEqual(result, { total: 2, sent: 2, expired: 0, failed: 0 });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].title, "تست");
  assert.equal(sent[0].body, "بدن");
  assert.equal(sent[0].url, "/courses/x");
  assert.equal(sent[0].ttl, 60);
});

test("sendPushToUsers prunes subscriptions that report 410 and keeps working", async () => {
  const deleted: string[] = [];
  const sender: PushSender = {
    async send(subscription) {
      if (subscription.endpoint === "https://push.example.com/expired") {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      }
    },
  };
  const subscriptions: PushSubscriptionRecord[] = [
    { id: "s1", endpoint: "https://push.example.com/expired", keys: JSON.stringify({ p256dh: "a", auth: "b" }), userId: "u1" },
    { id: "s2", endpoint: "https://push.example.com/ok", keys: JSON.stringify({ p256dh: "c", auth: "d" }), userId: "u2" },
  ];
  const result = await sendPushToUsers({
    userIds: ["u1", "u2"],
    title: "تست",
    sender,
    findSubscriptions: async () => subscriptions,
    deleteSubscription: async (id) => {
      deleted.push(id);
    },
  });
  assert.deepEqual(result, { total: 2, sent: 1, expired: 1, failed: 0 });
  assert.deepEqual(deleted, ["s1"]);
});

test("sendPushToUsers counts other failures as failed without deleting them", async () => {
  const deleted: string[] = [];
  const sender: PushSender = {
    async send() {
      throw Object.assign(new Error("network"), { statusCode: 500 });
    },
  };
  const subscriptions: PushSubscriptionRecord[] = [
    { id: "s1", endpoint: "https://push.example.com/1", keys: JSON.stringify({ p256dh: "a", auth: "b" }), userId: "u1" },
  ];
  const result = await sendPushToUsers({
    userIds: ["u1"],
    title: "تست",
    sender,
    findSubscriptions: async () => subscriptions,
    deleteSubscription: async (id) => {
      deleted.push(id);
    },
  });
  assert.deepEqual(result, { total: 1, sent: 0, expired: 0, failed: 1 });
  assert.deepEqual(deleted, []);
});

test("sendPushToUsers skips subscriptions with unparsable keys and counts them as failed", async () => {
  const sender: PushSender = {
    async send() {
      throw new Error("should not be called");
    },
  };
  const subscriptions: PushSubscriptionRecord[] = [
    { id: "s1", endpoint: "https://push.example.com/1", keys: "not-json", userId: "u1" },
    { id: "s2", endpoint: "https://push.example.com/2", keys: JSON.stringify({ p256dh: "a" }), userId: "u2" },
  ];
  const result = await sendPushToUsers({
    userIds: ["u1", "u2"],
    title: "تست",
    sender,
    findSubscriptions: async () => subscriptions,
    deleteSubscription: async () => {},
  });
  assert.deepEqual(result, { total: 2, sent: 0, expired: 0, failed: 2 });
});

test("sendPushToUsers short-circuits when there are no recipients", async () => {
  const result = await sendPushToUsers({
    userIds: [],
    title: "تست",
    findSubscriptions: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(result, { total: 0, sent: 0, expired: 0, failed: 0 });
});

test("registerPushSubscription stores JSON keys and delegates to the injected upsert", async () => {
  let captured: unknown = null;
  await registerPushSubscription({
    userId: "u1",
    endpoint: "https://push.example.com/1",
    keys: { p256dh: "a", auth: "b" },
    userAgent: "UA",
    upsert: async (data) => {
      captured = data;
    },
  });
  const data = captured as { userId: string; endpoint: string; keys: string; userAgent?: string };
  assert.equal(data.userId, "u1");
  assert.equal(data.endpoint, "https://push.example.com/1");
  assert.deepEqual(JSON.parse(data.keys), { p256dh: "a", auth: "b" });
  assert.equal(data.userAgent, "UA");
});

test("unregisterPushSubscription delegates to the injected deleter", async () => {
  let captured: unknown = null;
  await unregisterPushSubscription({
    userId: "u1",
    endpoint: "https://push.example.com/1",
    deleteMany: async (data) => {
      captured = data;
    },
  });
  assert.deepEqual(captured, { userId: "u1", endpoint: "https://push.example.com/1" });
});
