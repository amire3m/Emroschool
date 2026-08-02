import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authorization = req.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "نیازمند ورود به حساب کاربری هستید" }, { status: 401 });
  try {
    const application = await prisma.courseApplication.findFirst({ where: { id: params.id, userId: user.id } });
    if (!application) return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
    const data = await req.formData(); const file = data.get("file"); const key = data.get("key");
    if (!(file instanceof File) || typeof key !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) return NextResponse.json({ error: "فایل یا فیلد معتبر نیست" }, { status: 400 });
    if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "فقط تصویر JPG، PNG، WebP یا PDF تا ۵ مگابایت مجاز است" }, { status: 400 });
    const ext = file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    const directory = path.join(process.cwd(), "public", "uploads", "application-documents", application.id); await mkdir(directory, { recursive: true });
    const name = `${key}-${crypto.randomUUID()}${ext}`; await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/application-documents/${application.id}/${name}`;
    const responses = application.customResponses ? JSON.parse(application.customResponses) : {}; responses[key] = url;
    await prisma.courseApplication.update({ where: { id: application.id }, data: { customResponses: JSON.stringify(responses) } });
    return NextResponse.json({ url });
  } catch { return NextResponse.json({ error: "بارگذاری فایل انجام نشد" }, { status: 500 }); }
}
