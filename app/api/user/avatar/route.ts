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

    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${token.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`;
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/avatars/${fileName}`;
    await prisma.user.update({ where: { id: token.id }, data: { avatar: url } });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "خطا در آپلود آواتار" }, { status: 500 });
  }
}
