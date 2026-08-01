import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const application = await prisma.courseApplication.findUnique({ where: { id: params.id } });
    if (!application || application.userId !== user.id) return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    if (!application.discountCode || application.status !== "pending_payment") return NextResponse.json({ error: "این درخواست نیازی به مدرک تخفیف ندارد" }, { status: 400 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
    const ext = path.extname(file.name).toLowerCase();
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "حداکثر حجم فایل ۵ مگابایت است" }, { status: 413 });
    if (!allowedExtensions.has(ext) || !allowedTypes.has(file.type)) return NextResponse.json({ error: "فقط تصویر JPG، PNG یا WebP مجاز است" }, { status: 400 });
    const directory = path.join(process.cwd(), "public", "uploads", "discount-documents", application.id);
    await mkdir(directory, { recursive: true });
    const name = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
    const discountDocumentUrl = `/uploads/discount-documents/${application.id}/${name}`;
    const updated = await prisma.courseApplication.update({ where: { id: application.id }, data: { discountDocumentUrl } });
    return NextResponse.json({ application: updated, discountDocumentUrl });
  } catch (error) {
    console.error("Discount document upload error:", error);
    return NextResponse.json({ error: "بارگذاری مدرک انجام نشد" }, { status: 500 });
  }
}
