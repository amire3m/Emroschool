import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { queuePaymentReceiptEvent } from "@/lib/bale-group-notifications";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
const allowed = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]);

type ReceiptDependencies = {
  db: any;
  mkdir: typeof mkdir;
  writeFile: typeof writeFile;
  randomUUID: () => string;
  now: () => Date;
  onError: (error: unknown) => void;
};

const defaultDependencies: ReceiptDependencies = { db: prisma, mkdir, writeFile, randomUUID: crypto.randomUUID, now: () => new Date(), onError: (error) => console.error("Receipt upload error:", error) };

export async function POST(req: NextRequest, { params }: { params: { id: string } }, overrides: Partial<ReceiptDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const order = await dependencies.db.paymentOrder.findFirst({ where: { id: params.id, userId: user.id } });
    if (!order) return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    if (order.method !== "card_to_card" || !["awaiting_receipt", "rejected"].includes(order.status)) return NextResponse.json({ error: "این سفارش آماده دریافت رسید نیست" }, { status: 409 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !allowed.has(file.type)) return NextResponse.json({ error: "فقط تصویر JPG، PNG یا WebP مجاز است" }, { status: 400 });
    if (!file.size || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "حداکثر حجم رسید ۵ مگابایت است" }, { status: 413 });
    const ext = allowed.get(file.type)!;
    const directory = path.join(process.cwd(), "public", "uploads", "users", "receipts", user.id, order.id);
    await dependencies.mkdir(directory, { recursive: true });
    const name = `${dependencies.randomUUID()}${ext}`;
    await dependencies.writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
    const receiptUrl = `/uploads/users/receipts/${user.id}/${order.id}/${name}`;
    const updated = await dependencies.db.$transaction(async (tx: any) => {
      const current = await tx.paymentOrder.findUnique({ where: { id: order.id }, include: { user: { select: { name: true } }, course: { select: { title: true } } } });
      if (!current || !["awaiting_receipt", "rejected"].includes(current.status)) throw new Error("RECEIPT_CONFLICT");
      const attempt = current.activeAttemptId ? await tx.paymentAttempt.findFirst({ where: { id: current.activeAttemptId, orderId: current.id } }) : null;
      const submittedAt = dependencies.now();
      if (attempt) {
        const result = await tx.paymentAttempt.updateMany({ where: { id: attempt.id, orderId: current.id }, data: { receiptUrl, status: "under_review", submittedAt, rejectionReason: null } });
        if (result.count !== 1) throw new Error("INVALID_ATTEMPT");
      }
      const changed = await tx.paymentOrder.updateMany({
        where: { id: order.id, receiptSubmissionRevision: current.receiptSubmissionRevision, status: { in: ["awaiting_receipt", "rejected"] } },
        data: { receiptUrl, status: "under_review", receiptSubmittedAt: submittedAt, receiptSubmissionRevision: { increment: 1 }, rejectionReason: null },
      });
      if (changed.count !== 1) throw new Error("RECEIPT_CONFLICT");
      const revision = current.receiptSubmissionRevision + 1;
      await queuePaymentReceiptEvent(tx, current, revision, submittedAt);
      return tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
    });
    return NextResponse.json({ order: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "RECEIPT_CONFLICT") return NextResponse.json({ error: "رسید هم‌زمان دیگری ثبت شده است" }, { status: 409 });
    dependencies.onError(error);
    return NextResponse.json({ error: "بارگذاری رسید انجام نشد" }, { status: 500 });
  }
}
