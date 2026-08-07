import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!token) return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "فقط فایل تصویری مجاز است" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "حداکثر حجم آواتار ۵ مگابایت است" }, { status: 413 });

    const user = await prisma.user.findUnique({ where: { id: token.id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    const extension = path.extname(file.name).toLowerCase();
    if (!new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]).has(extension)) return NextResponse.json({ error: "فرمت تصویر مجاز نیست" }, { status: 400 });
    const uploadDir = path.join(process.cwd(), "public", "uploads", "users", "profiles", user.id, "avatar");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension}`;
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/users/profiles/${user.id}/avatar/${fileName}`;
    await prisma.$transaction(async (tx) => {
      await tx.avatarSubmission.updateMany({ where: { userId: token.id, status: "pending" }, data: { status: "superseded" } });
      return tx.avatarSubmission.create({ data: { userId: token.id, imageUrl: url } });
    });
    const submission = await prisma.avatarSubmission.findFirst({ where: { userId: token.id, imageUrl: url }, orderBy: { submittedAt: "desc" } });
    return NextResponse.json({ url, submission, message: "تصویر برای بررسی ارسال شد" });
  } catch {
    return NextResponse.json({ error: "خطا در آپلود آواتار" }, { status: 500 });
  }
}
