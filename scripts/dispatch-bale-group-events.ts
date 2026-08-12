import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { baleGroupEventActions, BaleGroupAction, canClaimBaleGroupEvent, formatBaleGroupEvent, retryBaleGroupEvent } from "../lib/bale-group-notifications";
import { isDefinitiveBaleApiRejection, sendMessage } from "../lib/bale-payment";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const STALE_LEASE_MS = 5 * 60_000;
const MAX_TEXT_LENGTH = 200;
const MAX_RELEASE_CAPABILITIES = 50;

type GroupEventDatabase = Pick<PrismaClient, "baleGroupEvent">;
type DispatchOptions = {
  chatId?: string;
  now?: Date;
  batchSize?: number;
  send?: typeof sendMessage;
};

type DispatchResult = {
  claimed: number;
  sent: number;
  retryable: number;
  uncertain: number;
  needsReview: number;
};

function emptyResult(): DispatchResult {
  return { claimed: 0, sent: 0, retryable: 0, uncertain: 0, needsReview: 0 };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isSafeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

function isValidHistoricalInstant(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, y, mo, d, h, mi, s, ms = "000", zone, sign, oh = "00", om = "00"] = match;
  const [year, month, day, hour, minute, second, millis, offsetHour, offsetMinute] = [y, mo, d, h, mi, s, ms, oh, om].map(Number);
  if (year < 2000 || year > 2100 || hour > 23 || minute > 59 || second > 59 || offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millis));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return false;
  const offset = zone === "Z" ? 0 : (sign === "+" ? 1 : -1) * (offsetHour * 60 + offsetMinute) * 60_000;
  const instant = calendar.getTime() - offset;
  return Number.isFinite(instant) && instant >= Date.UTC(2000, 0, 1) && instant <= Date.UTC(2100, 11, 31, 23, 59, 59, 999);
}

function isCanonicalIsoInstant(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value && instant.getUTCFullYear() >= 2000 && instant.getUTCFullYear() <= 2100;
}

function parseEvent(candidate: { type: string; payload: string }): Parameters<typeof formatBaleGroupEvent>[0] | null {
  let payload: unknown;
  try {
    payload = JSON.parse(candidate.payload);
  } catch {
    return null;
  }
  if (!isPlainObject(payload)) return null;

  if (candidate.type === "payment_paid" || candidate.type === "payment_duplicate") {
    if (!hasExactKeys(payload, ["studentName", "courseTitle", "amountTomans", "method", "orderNumber", "paidAt"])) return null;
    if (!isSafeText(payload.studentName) || !isSafeText(payload.courseTitle) || !isSafeText(payload.orderNumber)) return null;
    if (!Number.isSafeInteger(payload.amountTomans) || (payload.amountTomans as number) <= 0) return null;
    if (!(["bale_wallet", "card_to_card", "manual"] as unknown[]).includes(payload.method)) return null;
    if (!isValidHistoricalInstant(payload.paidAt)) return null;
    return { type: candidate.type, payload: payload as Parameters<typeof formatBaleGroupEvent>[0]["payload"] } as Parameters<typeof formatBaleGroupEvent>[0];
  }

  if (candidate.type === "release") {
    if (!hasExactKeys(payload, ["version", "title", "publishedAt", "capabilities"])) return null;
    if (!isSafeText(payload.version) || !isSafeText(payload.title) || !isValidHistoricalInstant(payload.publishedAt)) return null;
    if (!Array.isArray(payload.capabilities) || payload.capabilities.length > MAX_RELEASE_CAPABILITIES) return null;
    if (!payload.capabilities.every(isSafeText)) return null;
    return { type: "release", payload: payload as Parameters<typeof formatBaleGroupEvent>[0]["payload"] } as Parameters<typeof formatBaleGroupEvent>[0];
  }

  const requestKeys: Record<string, string[]> = {
    support_ticket: ["displayName", "subject", "submittedAt", "ticketId", "userId", "actions"],
    support_user_message: ["displayName", "subject", "submittedAt", "ticketId", "messageId", "userId", "actions"],
    course_application: ["displayName", "courseTitle", "reviewState", "submittedAt", "applicationId", "userId", "actions"],
    payment_receipt: ["displayName", "courseTitle", "orderNumber", "amountTomans", "submittedAt", "orderId", "userId", "actions"],
    profile_review: ["displayName", "submittedAt", "userId", "actions"],
    avatar_review: ["displayName", "submittedAt", "submissionId", "userId", "actions"],
  };
  const keys = requestKeys[candidate.type];
  if (keys && hasExactKeys(payload, keys)) {
    if (!keys.filter((key) => !["submittedAt", "actions", "amountTomans"].includes(key)).every((key) => isSafeText(payload[key]))) return null;
    if (!isCanonicalIsoInstant(payload.submittedAt)) return null;
    const expectedActions: Record<string, string[]> = { support_ticket: ["support_ticket", "user"], support_user_message: ["support_ticket", "user"], course_application: ["course_application", "user"], payment_receipt: ["payment_order", "user"], profile_review: ["user"], avatar_review: ["user"] };
    if (!Array.isArray(payload.actions) || JSON.stringify(payload.actions) !== JSON.stringify(expectedActions[candidate.type])) return null;
    if (candidate.type === "course_application" && payload.reviewState !== "pending") return null;
    if (candidate.type === "payment_receipt" && (!Number.isSafeInteger(payload.amountTomans) || (payload.amountTomans as number) <= 0)) return null;
    return { type: candidate.type, payload } as Parameters<typeof formatBaleGroupEvent>[0];
  }

  const legacyKeys: Record<string, string[]> = {
    support_ticket: ["displayName", "subject", "submittedAt", "ticketId", "userId"],
    support_user_message: ["displayName", "subject", "submittedAt", "ticketId", "messageId", "userId"],
    course_application: ["displayName", "courseTitle", "submittedAt", "applicationId", "userId"],
    payment_receipt: ["displayName", "courseTitle", "orderNumber", "submittedAt", "orderId", "userId"],
    profile_review: ["displayName", "submittedAt", "userId"],
    avatar_review: ["displayName", "submittedAt", "submissionId", "userId"],
  };
  const legacy = legacyKeys[candidate.type];
  if (legacy && hasExactKeys(payload, legacy) && legacy.filter((key) => key !== "submittedAt").every((key) => isSafeText(payload[key])) && isCanonicalIsoInstant(payload.submittedAt)) {
    const actions: Record<string, string[]> = { support_ticket: ["support_ticket", "user"], support_user_message: ["support_ticket", "user"], course_application: ["course_application", "user"], payment_receipt: ["payment_order", "user"], profile_review: ["user"], avatar_review: ["user"] };
    return { type: candidate.type, payload: { ...payload, ...(candidate.type === "course_application" ? { reviewState: "pending" } : {}), actions: actions[candidate.type] } } as unknown as Parameters<typeof formatBaleGroupEvent>[0];
  }
  return null;
}

function sendOptions(event: Parameters<typeof formatBaleGroupEvent>[0]) {
  const actions = baleGroupEventActions(event);
  if (!actions.length) return undefined;
  return { actions };
}

export async function dispatchBaleGroupEvents(db: GroupEventDatabase, options: DispatchOptions = {}) {
  const chatId = options.chatId ?? process.env.BALE_COORDINATION_CHAT_ID ?? "";
  if (!chatId.trim()) return emptyResult();
  if (!options.send && !process.env.BALE_BOT_TOKEN?.trim()) return emptyResult();

  const now = options.now ?? new Date();
  const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE));
  const staleBefore = new Date(now.getTime() - STALE_LEASE_MS);
  const candidates = await db.baleGroupEvent.findMany({
    where: {
      OR: [
        { status: { in: ["pending", "retryable"] }, nextAttemptAt: { lte: now }, attempts: { lt: 10 } },
        { status: "processing", claimedAt: { lt: staleBefore }, sendStartedAt: null, attempts: { lt: 10 } },
        { status: "processing", sendStartedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
  });
  const result = emptyResult();

  for (const candidate of candidates) {
    try {
      if (candidate.status === "processing" && candidate.sendStartedAt && candidate.sendStartedAt < staleBefore) {
        const recovered = await db.baleGroupEvent.updateMany({
          where: {
            id: candidate.id,
            status: "processing",
            attempts: candidate.attempts,
            claimedAt: candidate.claimedAt,
            sendStartedAt: candidate.sendStartedAt,
          },
          data: { status: "uncertain", nextAttemptAt: now, lastError: "BALE_STALE_SEND_UNCERTAIN" },
        });
        if (recovered.count === 1) result.uncertain += 1;
        continue;
      }
      if (!canClaimBaleGroupEvent(candidate, now, staleBefore)) continue;

      const claim = await db.baleGroupEvent.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          attempts: candidate.attempts,
          nextAttemptAt: candidate.nextAttemptAt,
          claimedAt: candidate.claimedAt,
          sendStartedAt: null,
        },
        data: {
          status: "processing",
          claimedAt: now,
          sendStartedAt: null,
          lastError: null,
        },
      });
      if (claim.count !== 1) continue;
      result.claimed += 1;

      const parsedEvent = parseEvent(candidate);
      if (!parsedEvent) {
        const quarantined = await db.baleGroupEvent.updateMany({
          where: { id: candidate.id, status: "processing", attempts: candidate.attempts, claimedAt: now, sendStartedAt: null },
          data: { status: "needs_review", lastError: "INVALID_EVENT_PAYLOAD" },
        });
        if (quarantined.count === 1) result.needsReview += 1;
        continue;
      }
      const message = formatBaleGroupEvent(parsedEvent);
      const messageOptions = sendOptions(parsedEvent);

      const started = await db.baleGroupEvent.updateMany({
        where: { id: candidate.id, status: "processing", attempts: candidate.attempts, claimedAt: now, sendStartedAt: null },
        data: { attempts: { increment: 1 }, sendStartedAt: now },
      });
      if (started.count !== 1) continue;
      const attempts = candidate.attempts + 1;

      try {
        await (options.send ?? sendMessage)(chatId, message, messageOptions);
        const persisted = await db.baleGroupEvent.updateMany({
          where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: now },
          data: {
            status: "sent",
            sentAt: now,
            nextAttemptAt: now,
            lastError: null,
            providerResponseId: null,
          },
        });
        if (persisted.count === 1) result.sent += 1;
      } catch (error) {
        if (isDefinitiveBaleApiRejection(error)) {
          const retry = retryBaleGroupEvent(now, attempts);
          const persisted = await db.baleGroupEvent.updateMany({
            where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: now },
            data: {
              status: retry.status,
              ...(retry.nextAttemptAt ? { nextAttemptAt: retry.nextAttemptAt } : {}),
              ...(retry.status === "retryable" ? { claimedAt: null, sendStartedAt: null } : {}),
              lastError: "BALE_DEFINITIVE_REJECTION",
            },
          });
          if (persisted.count === 1) {
            if (retry.status === "needs_review") result.needsReview += 1;
            else result.retryable += 1;
          }
        } else {
          const persisted = await db.baleGroupEvent.updateMany({
            where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: now },
            data: { status: "uncertain", nextAttemptAt: now, lastError: "BALE_DELIVERY_UNCERTAIN" },
          });
          if (persisted.count === 1) result.uncertain += 1;
        }
      }
    } catch {
      // Keep processing other rows; event state remains the durable source of truth.
    }
  }

  return result;
}

export function isDirectExecution(moduleUrl: string, entryPath = process.argv[1]) {
  return Boolean(entryPath) && path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

async function main() {
  const db = new PrismaClient();
  try {
    console.log(JSON.stringify(await dispatchBaleGroupEvents(db)));
  } finally {
    await db.$disconnect();
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch(() => {
    console.error("BALE_GROUP_DISPATCH_FAILED");
    process.exitCode = 1;
  });
}
