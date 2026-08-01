import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sendMessage } from "@/lib/bale-payment";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
const allowed = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const order = await prisma.paymentOrder.findFirst({ where: { id: params.id, userId: user.id } });
    if (!order) return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    if (order.method !== "card_to_card" || order.status !== "awaiting_receipt") return NextResponse.json({ error: "این سفارش آماده دریافت رسید نیست" }, { status: 409 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !allowed.has(file.type)) return NextResponse.json({ error: "فقط تصویر JPG، PNG یا WebP مجاز است" }, { status: 400 });
    if (!file.size || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "حداکثر حجم رسید ۵ مگابایت است" }, { status: 413 });
    const ext = allowed.get(file.type)!;
    const directory = path.join(process.cwd(), "public", "uploads", "payment-receipts", order.id);
    await mkdir(directory, { recursive: true });
    const name = `${crypto.randomUUID()}${ext}`;
    await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
    const receiptUrl = `/uploads/payment-receipts/${order.id}/${name}`;
    const updated = await prisma.paymentOrder.update({ where: { id: order.id }, data: { receiptUrl, status: "under_review", receiptSubmittedAt: new Date() } });
    const settings = await prisma.paymentSettings.findUnique({ where: { id: 1 } });
    if (settings?.adminChatId) sendMessage(settings.adminChatId, `رسید جدید پرداخت ${updated.orderNumber} برای بررسی ثبت شد.`).catch(() => undefined);
    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Receipt upload error:", error);
    return NextResponse.json({ error: "بارگذاری رسید انجام نشد" }, { status: 500 });
  }
}
