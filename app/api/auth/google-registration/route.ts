import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { normalizeIranianPhone } from "@/lib/bale-otp";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!token) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const { name, gender, phone } = await req.json();
  const normalizedName = String(name || "").trim().replace(/\s+/g, " ");
  if (!/^[آ-ی ]+$/.test(normalizedName) || normalizedName.split(" ").filter(Boolean).length < 2) {
    return NextResponse.json({ error: "نام و نام خانوادگی را فقط با حروف فارسی وارد کنید" }, { status: 400 });
  }
  if (!["male", "female"].includes(gender)) return NextResponse.json({ error: "جنسیت را انتخاب کنید" }, { status: 400 });
  const normalizedPhone = normalizeIranianPhone(phone || "");
  if (!normalizedPhone) return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: token.id }, select: { id: true, emailVerified: true } });
  if (!user?.emailVerified) return NextResponse.json({ error: "ایمیل حساب گوگل باید تأیید شده باشد" }, { status: 400 });
  await prisma.user.update({ where: { id: token.id }, data: { name: normalizedName, gender, phone: normalizedPhone, phoneVerified: false } });
  return NextResponse.json({ success: true });
}
