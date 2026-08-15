import webpush from "web-push";
import prisma from "./prisma";

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: string;
  userId: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

export interface PushSendResult {
  total: number;
  sent: number;
  expired: number;
  failed: number;
}

export interface PushSender {
  send(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: PushPayload,
    ttlSeconds: number,
  ): Promise<void>;
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:no-reply@imamruhollahschool.com";

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return isPushConfigured() ? VAPID_PUBLIC_KEY : null;
}

function ensureWebPushConfigured() {
  if (!isPushConfigured()) {
    throw new Error("Web push is not configured: VAPID keys are missing");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const defaultSender: PushSender = {
  async send(subscription, payload, ttlSeconds) {
    ensureWebPushConfigured();
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttlSeconds });
  },
};

export function isExpiredSubscriptionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: number }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushToUsers(options: {
  userIds: string[];
  title: string;
  body?: string;
  url?: string;
  ttlSeconds?: number;
  sender?: PushSender;
  findSubscriptions?: (userIds: string[]) => Promise<PushSubscriptionRecord[]>;
  deleteSubscription?: (id: string) => Promise<void>;
}): Promise<PushSendResult> {
  const {
    userIds,
    title,
    body,
    url = "/",
    ttlSeconds = 12 * 60 * 60,
    sender = defaultSender,
    findSubscriptions = async (ids) => prisma.pushSubscription.findMany({ where: { userId: { in: ids } } }),
    deleteSubscription = async (id) => {
      await prisma.pushSubscription.delete({ where: { id } });
    },
  } = options;

  if (userIds.length === 0) return { total: 0, sent: 0, expired: 0, failed: 0 };

  const subscriptions = await findSubscriptions(userIds);
  const payload: PushPayload = { title, body, url };

  const result: PushSendResult = { total: subscriptions.length, sent: 0, expired: 0, failed: 0 };
  const expiredIds: string[] = [];

  for (const subscription of subscriptions) {
    let keys: { p256dh?: unknown; auth?: unknown } | null = null;
    try {
      keys = JSON.parse(subscription.keys);
    } catch {
      keys = null;
    }
    if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
      result.failed++;
      continue;
    }
    try {
      await sender.send(
        { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        payload,
        ttlSeconds,
      );
      result.sent++;
    } catch (error) {
      if (isExpiredSubscriptionError(error)) {
        result.expired++;
        expiredIds.push(subscription.id);
      } else {
        result.failed++;
      }
    }
  }

  if (expiredIds.length > 0) {
    await Promise.allSettled(expiredIds.map((id) => deleteSubscription(id)));
  }

  return result;
}

export interface ParsedPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export function parsePushSubscriptionInput(input: unknown): ParsedPushSubscription | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.endpoint !== "string") return null;
  if (!record.keys || typeof record.keys !== "object") return null;
  const { p256dh, auth } = record.keys as Record<string, unknown>;
  if (typeof p256dh !== "string" || p256dh.length === 0) return null;
  if (typeof auth !== "string" || auth.length === 0) return null;

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(record.endpoint);
  } catch {
    return null;
  }
  if (parsedEndpoint.protocol !== "https:" && parsedEndpoint.protocol !== "http:") return null;
  if (parsedEndpoint.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsedEndpoint.hostname)) return null;

  return {
    endpoint: record.endpoint,
    keys: { p256dh, auth },
    userAgent: typeof record.userAgent === "string" && record.userAgent.length > 0 ? record.userAgent : undefined,
  };
}

export async function registerPushSubscription(options: {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  upsert?: (data: { userId: string; endpoint: string; keys: string; userAgent?: string }) => Promise<unknown>;
}): Promise<void> {
  const { userId, endpoint, keys, userAgent } = options;
  const upsert =
    options.upsert ||
    (async (data) =>
      prisma.pushSubscription.upsert({
        where: { endpoint: data.endpoint },
        update: { userId: data.userId, keys: data.keys, userAgent: data.userAgent },
        create: { endpoint: data.endpoint, userId: data.userId, keys: data.keys, userAgent: data.userAgent },
      }));
  await upsert({ userId, endpoint, keys: JSON.stringify(keys), userAgent });
}

export async function unregisterPushSubscription(options: {
  userId: string;
  endpoint: string;
  deleteMany?: (data: { userId: string; endpoint: string }) => Promise<unknown>;
}): Promise<void> {
  const { userId, endpoint } = options;
  const deleteMany =
    options.deleteMany ||
    (async (data) => prisma.pushSubscription.deleteMany({ where: { userId: data.userId, endpoint: data.endpoint } }));
  await deleteMany({ userId, endpoint });
}
