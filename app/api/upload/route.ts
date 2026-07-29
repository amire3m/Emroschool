import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
    }

    const ext = path.extname(file.name) || ".bin";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    const url = `/uploads/${uniqueName}`;

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: "خطا در آپلود فایل" }, { status: 500 });
  }
}
