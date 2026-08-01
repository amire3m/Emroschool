import prisma from "@/lib/prisma";
import { generateToken, hashPassword } from "@/lib/auth";
import { issueEmailVerificationCode } from "@/lib/verification";
import { normalizeBalePhone } from "@/lib/bale-otp";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, phone } = await req.json();

    if (!email || !name || !password || !phone) {
      return NextResponse.json({ error: "ایمیل، نام، موبایل و رمز عبور الزامی است" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeBalePhone(phone);
    if (!normalizedPhone) return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing?.emailVerified) {
      return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    const user = existing ? await prisma.user.update({ where: { id: existing.id }, data: { name: name.trim(), password: hashed, phone: normalizedPhone, emailVerified: false, phoneVerified: false } }) : await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashed,
        phone: normalizedPhone,
        role: "user",
        userType: "student",
        profileVisible: false,
        emailVerified: false,
      },
    });
    return NextResponse.json({ requiresVerification: true, email: user.email, phone: normalizedPhone, message: "روش تأیید حساب را انتخاب کنید" }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "خطا در ثبت نام" }, { status: 500 });
  }
}
