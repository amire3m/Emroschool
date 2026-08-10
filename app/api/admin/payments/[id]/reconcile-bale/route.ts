import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { inquireTransaction } from "@/lib/bale-payment";
import { isBaleAmountValid, isBalePaidStatus } from "@/lib/bale-payment-domain";
import { finalizeBalePayment } from "@/lib/bale-payment-finalization";
import { selectBaleReconciliationAttempt } from "@/lib/bale-payment-reconciliation";
import { runPaymentTransaction } from "@/lib/payment-transaction";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type ReconciliationDependencies = {
  db: any;
  authorize: (request: NextRequest) => Promise<{ id: string } | null>;
  inquire: typeof inquireTransaction;
  now: () => Date;
  onError: (error: unknown) => void;
};

async function authorizePaymentAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ")
    ? await getUserFromToken(authorization.slice(7))
    : null;
  if (!user || !isAdminRole(user.role)) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try {
    const permissions = JSON.parse(user.permissions);
    return Array.isArray(permissions) &&
      (permissions.length === 0 || permissions.includes("payments") || permissions.includes("support"))
      ? user
      : null;
  } catch {
    return null;
  }
}

const defaultDependencies: ReconciliationDependencies = {
  db: prisma,
  authorize: authorizePaymentAdmin,
  inquire: inquireTransaction,
  now: () => new Date(),
  onError: (error) => console.error("Bale payment reconciliation error:", error),
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "ORDER_NOT_FOUND") return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
  if (message === "TRACKING_REQUIRED") return NextResponse.json({ error: "شماره پیگیری بله الزامی است" }, { status: 400 });
  if (message === "INVALID_INPUT") return NextResponse.json({ error: "اطلاعات بازیابی پرداخت نامعتبر است" }, { status: 400 });
  if (message === "NOT_RECOVERABLE") return NextResponse.json({ error: "این سفارش برای بازیابی پرداخت بله مناسب نیست" }, { status: 409 });
  if (message === "TRANSACTION_NOT_PAID") return NextResponse.json({ error: "وضعیت تراکنش در بله paid نیست" }, { status: 422 });
  if (message === "AMOUNT_MISMATCH") return NextResponse.json({ error: "مبلغ ریالی تراکنش با سفارش یکسان نیست" }, { status: 422 });
  if (message === "TRANSACTION_ID_MISMATCH") return NextResponse.json({ error: "شناسه تراکنش با شناسه پرداخت ذخیره‌شده یکسان نیست" }, { status: 409 });
  if (message === "TRANSACTION_ALREADY_USED" || message === "BALE_PAYMENT_IDENTIFIER_CONFLICT" || (error as { code?: unknown })?.code === "P2002") {
    return NextResponse.json({ error: "این تراکنش قبلا برای پرداخت دیگری استفاده شده است" }, { status: 409 });
  }
  if (message === "TRANSACTION_NOT_FOUND") return NextResponse.json({ error: "تراکنش در بله پیدا نشد" }, { status: 422 });
  if (message === "INQUIRY_FAILED") return NextResponse.json({ error: "ارتباط با بله برای استعلام تراکنش ناموفق بود" }, { status: 502 });
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
  overrides: Partial<ReconciliationDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (!await dependencies.authorize(request)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" ||
      (body.trackingNumber !== undefined && typeof body.trackingNumber !== "string") ||
      (body.receiptReference !== undefined && typeof body.receiptReference !== "string")) {
      throw new Error("INVALID_INPUT");
    }
    const trackingNumber = body.trackingNumber?.trim() || "";
    const receiptReference = body.receiptReference?.trim() || "";
    const order = await dependencies.db.paymentOrder.findUnique({
      where: { id: params.id },
      include: { attempts: { orderBy: { sequence: "desc" } } },
    });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "paid") throw new Error("NOT_RECOVERABLE");

    const targetAttempt = selectBaleReconciliationAttempt(order);
    if (targetAttempt && ["paid", "paid_duplicate"].includes(targetAttempt.status)) {
      throw new Error("NOT_RECOVERABLE");
    }
    const storedPaymentId = targetAttempt?.balePaymentId?.trim() || "";
    const storedTracking = targetAttempt?.baleTrackingNumber?.trim() ||
      (!targetAttempt && order.method === "bale_wallet" ? order.baleTransactionRef?.trim() : "") || "";
    const fallbackTracking = storedTracking || trackingNumber;
    if (!storedPaymentId && !fallbackTracking) throw new Error("TRACKING_REQUIRED");
    const payload = targetAttempt?.balePayload || order.balePayload;
    if (!payload) throw new Error("NOT_RECOVERABLE");

    const references = [...new Set([storedPaymentId, fallbackTracking].filter(Boolean))];
    let inquiryResult: Record<string, unknown> | null = null;
    let inquiryError: unknown = null;
    let successfulReference = "";
    for (const [index, reference] of references.entries()) {
      try {
        const inquiry = await dependencies.inquire(reference);
        inquiryResult = inquiry?.result && typeof inquiry.result === "object" && !Array.isArray(inquiry.result)
          ? inquiry.result as Record<string, unknown>
          : null;
        inquiryError = null;
        if (inquiryResult) {
          successfulReference = reference;
          break;
        }
      } catch (error) {
        inquiryError = error;
        if (index === references.length - 1) break;
      }
    }
    if (!inquiryResult) {
      if (!inquiryError) throw new Error("TRANSACTION_NOT_FOUND");
      const detail = inquiryError instanceof Error ? inquiryError.message.toLowerCase() : "";
      throw new Error(/unknown|not found|http 40[04]/.test(detail) ? "TRANSACTION_NOT_FOUND" : "INQUIRY_FAILED");
    }

    if (!isBalePaidStatus(inquiryResult.status)) throw new Error("TRANSACTION_NOT_PAID");
    const expectedAmount = targetAttempt?.amountRials ?? order.amountRials;
    if (!isBaleAmountValid(inquiryResult.amount, expectedAmount)) throw new Error("AMOUNT_MISMATCH");
    const returnedPaymentId = typeof inquiryResult.id === "string" || typeof inquiryResult.id === "number"
      ? String(inquiryResult.id).trim()
      : "";
    if (!returnedPaymentId || (storedPaymentId && returnedPaymentId !== storedPaymentId)) {
      throw new Error("TRANSACTION_ID_MISMATCH");
    }
    const verifiedTracking = storedTracking ||
      (successfulReference === fallbackTracking ? fallbackTracking : undefined);

    const paidAt = dependencies.now();
    const result = await runPaymentTransaction(dependencies.db, async (tx) => {
      const currentOrder = await tx.paymentOrder.findUnique({
        where: { id: order.id },
        include: { attempts: { orderBy: { sequence: "desc" } } },
      });
      if (!currentOrder) throw new Error("ORDER_NOT_FOUND");
      if (currentOrder.status === "paid") throw new Error("NOT_RECOVERABLE");
      let attempt = targetAttempt
        ? currentOrder.attempts.find((item: any) => item.id === targetAttempt.id)
        : null;
      if (targetAttempt && (!attempt || attempt.method !== "bale_wallet")) throw new Error("NOT_RECOVERABLE");
      if (!attempt) {
        const sequence = currentOrder.attempts.reduce((highest: number, item: any) => Math.max(highest, item.sequence), 0) + 1;
        attempt = await tx.paymentAttempt.create({
          data: {
            orderId: currentOrder.id,
            sequence,
            method: "bale_wallet",
            status: "pending",
            amountTomans: currentOrder.amountTomans,
            amountRials: currentOrder.amountRials,
            balePayload: payload,
          },
        });
      }
      if (attempt.baleReceiptReference && receiptReference && attempt.baleReceiptReference !== receiptReference) {
        throw new Error("TRANSACTION_ID_MISMATCH");
      }
      const finalized = await finalizeBalePayment(tx, {
        attemptId: attempt.id,
        invoicePayload: payload,
        currency: "IRR",
        totalAmount: expectedAmount,
        balePaymentId: returnedPaymentId,
        baleTrackingNumber: verifiedTracking,
        verificationSource: "inquiry_paid",
        paidAt,
      });
      if (finalized !== "paid") throw new Error("TRANSACTION_ALREADY_USED");
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          baleVerificationStatus: "inquiry_paid",
          ...(receiptReference ? { baleReceiptReference: receiptReference } : {}),
        },
      });
      return finalized;
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const response = errorResponse(error);
    if (response) return response;
    dependencies.onError(error);
    return NextResponse.json({ error: "بازیابی پرداخت بله انجام نشد" }, { status: 500 });
  }
}
