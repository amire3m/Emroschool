import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { effectiveBaleExpiry, isExpired } from "@/lib/bale-payment-domain";
import { NextRequest, NextResponse } from "next/server";
import { runPaymentTransaction } from "@/lib/payment-transaction";

type ExpirationDependencies = { db: any; now: () => Date };

const defaultDependencies: ExpirationDependencies = { db: prisma, now: () => new Date() };

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
  overrides: Partial<ExpirationDependencies> = {},
) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  const dependencies = { ...defaultDependencies, ...overrides };
  try {
    const now = dependencies.now();
    const order = await runPaymentTransaction(dependencies.db, async (tx) => {
      const current = await tx.paymentOrder.findFirst({ where: { id: params.id, userId: user.id } });
      if (!current) throw new Error("NOT_FOUND");
      if (current.status === "paid" || current.method !== "bale_wallet" || current.status !== "pending") return current;
      const attempt = current.activeAttemptId ? await tx.paymentAttempt.findFirst({ where: { id: current.activeAttemptId, orderId: current.id } }) : null;
      if (!attempt || attempt.status === "paid" || attempt.method !== "bale_wallet" || attempt.status !== "pending" || !(attempt.createdAt instanceof Date)) return current;
      const expiresAt = effectiveBaleExpiry(attempt.expiresAt, attempt.createdAt);
      if (!isExpired(expiresAt, now)) {
        await tx.paymentAttempt.updateMany({ where: { id: attempt.id, orderId: current.id }, data: { expiresAt } });
        return tx.paymentOrder.update({ where: { id: current.id }, data: { expiresAt } });
      }
      const updated = await tx.paymentAttempt.updateMany({ where: { id: attempt.id, orderId: current.id }, data: { expiresAt, status: "expired", invalidatedAt: now } });
      if (updated.count !== 1) throw Object.assign(new Error("Active attempt changed"), { code: "P2034" });
      return tx.paymentOrder.update({ where: { id: current.id }, data: { status: "expired", expiresAt } });
    });
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    return NextResponse.json({ error: "انقضای پرداخت انجام نشد" }, { status: 500 });
  }
}
