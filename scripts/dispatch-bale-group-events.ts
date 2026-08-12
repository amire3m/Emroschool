import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canClaimBaleGroupEvent, formatBaleGroupEvent, retryBaleGroupEvent } from "../lib/bale-group-notifications";
import { isDefinitiveBaleApiRejection, sendMessage } from "../lib/bale-payment";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const STALE_CLAIM_MS = 5 * 60_000;

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

export async function dispatchBaleGroupEvents(db: GroupEventDatabase, options: DispatchOptions = {}) {
  const chatId = options.chatId ?? process.env.BALE_COORDINATION_CHAT_ID ?? "";
  if (!chatId.trim()) return emptyResult();

  const now = options.now ?? new Date();
  const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE));
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const candidates = await db.baleGroupEvent.findMany({
    where: {
      OR: [
        { status: { in: ["pending", "retryable"] }, nextAttemptAt: { lte: now }, attempts: { lt: 10 } },
        { status: "processing", claimedAt: { lt: staleBefore }, sendStartedAt: null, attempts: { lt: 10 } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
  });
  const due = candidates
    .filter((candidate) => canClaimBaleGroupEvent(candidate, now, staleBefore))
    .slice(0, batchSize);
  const result = emptyResult();

  for (const candidate of due) {
    try {
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
          attempts: { increment: 1 },
          claimedAt: now,
          sendStartedAt: null,
          lastError: null,
        },
      });
      if (claim.count !== 1) continue;
      result.claimed += 1;

      const attempts = candidate.attempts + 1;
      let message: string;
      try {
        message = formatBaleGroupEvent({
          type: candidate.type as "payment_paid" | "payment_duplicate" | "release",
          payload: JSON.parse(candidate.payload),
        } as Parameters<typeof formatBaleGroupEvent>[0]);
      } catch {
        await db.baleGroupEvent.updateMany({
          where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: null },
          data: { status: "needs_review", lastError: "INVALID_EVENT_PAYLOAD" },
        });
        result.needsReview += 1;
        continue;
      }

      const started = await db.baleGroupEvent.updateMany({
        where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: null },
        data: { sendStartedAt: now },
      });
      if (started.count !== 1) continue;

      try {
        await (options.send ?? sendMessage)(chatId, message);
        await db.baleGroupEvent.updateMany({
          where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: now },
          data: {
            status: "sent",
            sentAt: now,
            nextAttemptAt: now,
            lastError: null,
            providerResponseId: null,
          },
        });
        result.sent += 1;
      } catch (error) {
        if (isDefinitiveBaleApiRejection(error)) {
          const retry = retryBaleGroupEvent(now, attempts);
          await db.baleGroupEvent.updateMany({
            where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: now },
            data: {
              status: retry.status,
              ...(retry.nextAttemptAt ? { nextAttemptAt: retry.nextAttemptAt } : {}),
              ...(retry.status === "retryable" ? { claimedAt: null, sendStartedAt: null } : {}),
              lastError: "BALE_DEFINITIVE_REJECTION",
            },
          });
          if (retry.status === "needs_review") result.needsReview += 1;
          else result.retryable += 1;
        } else {
          await db.baleGroupEvent.updateMany({
            where: { id: candidate.id, status: "processing", attempts, claimedAt: now, sendStartedAt: now },
            data: { status: "uncertain", nextAttemptAt: now, lastError: "BALE_DELIVERY_UNCERTAIN" },
          });
          result.uncertain += 1;
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
