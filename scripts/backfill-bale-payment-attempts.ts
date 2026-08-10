import { PrismaClient } from "@prisma/client";
import { effectiveBaleExpiry } from "../lib/bale-payment-domain";

type BackfillDatabase = Pick<PrismaClient, "$transaction">;

export async function backfillLegacyBalePayments(db: BackfillDatabase, now = new Date()) {
  return db.$transaction(async (tx) => {
    const legacyAttempts = await tx.paymentAttempt.findMany({
      where: { method: "bale_wallet", expiresAt: null },
      select: { id: true, orderId: true, status: true, createdAt: true },
    });
    let deadlinesBackfilled = 0;
    let attemptsExpired = 0;
    const affectedOrderIds = new Set<string>();

    for (const attempt of legacyAttempts) {
      const expiresAt = effectiveBaleExpiry(null, attempt.createdAt);
      const expires = attempt.status === "pending" && expiresAt.getTime() <= now.getTime();
      const updated = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, orderId: attempt.orderId, expiresAt: null },
        data: {
          expiresAt,
          ...(expires ? { status: "expired", invalidatedAt: now } : {}),
        },
      });
      if (updated.count !== 1) continue;
      deadlinesBackfilled += 1;
      affectedOrderIds.add(attempt.orderId);
      if (expires) {
        attemptsExpired += 1;
      }
    }

    let ordersNormalized = 0;
    for (const orderId of affectedOrderIds) {
      const order = await tx.paymentOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, activeAttemptId: true },
      });
      if (!order || order.status !== "pending" || !order.activeAttemptId) continue;
      const active = await tx.paymentAttempt.findFirst({
        where: { id: order.activeAttemptId, orderId: order.id },
        select: { id: true, status: true, expiresAt: true },
      });
      if (!active?.expiresAt) continue;
      const updated = await tx.paymentOrder.updateMany({
        where: { id: order.id, activeAttemptId: active.id },
        data: {
          expiresAt: active.expiresAt,
          ...(order.status === "pending" && active.status === "expired" ? { status: "expired" } : {}),
        },
      });
      ordersNormalized += updated.count;
    }

    return { deadlinesBackfilled, attemptsExpired, ordersNormalized };
  });
}

async function main() {
  const db = new PrismaClient();
  try {
    const result = await backfillLegacyBalePayments(db);
    console.log(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
