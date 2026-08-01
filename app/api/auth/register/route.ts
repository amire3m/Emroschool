import prisma from "@/lib/prisma";
import { generateToken, hashPassword } from "@/lib/auth";
import { issueEmailVerificationCode, sendWelcomeEmail } from "@/lib/verification";
import { issueBaleOtp, normalizeBalePhone } from "@/lib/bale-otp";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, phone } = await req.json();

    if (!email || !name || !password || !phone) {
      return NextResponse.json({ error: "ایمیل، نام، موبایل و رمز عبور الزامی است" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const requiresVerification = process.env.REQUIRE_EMAIL_VERIFICATION === "true";
    const normalizedPhone = normalizeBalePhone(phone);
    if (!normalizedPhone) return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing?.emailVerified) {
      return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    const user = existing ? await prisma.user.update({ where: { id: existing.id }, data: { name: name.trim(), password: hashed, phone: normalizedPhone, emailVerified: !requiresVerification } }) : await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashed,
        phone: normalizedPhone,
        role: "user",
        userType: "student",
        profileVisible: false,
        emailVerified: !requiresVerification,
      },
    });
    if (requiresVerification) {
      await issueEmailVerificationCode(user.email, user.name);
      return NextResponse.json({ requiresVerification: true, channel: "email", destination: user.email, message: "کد تأیید به ایمیل شما ارسال شد" }, { status: 201 });
    }
    await issueBaleOtp(normalizedPhone, "register");
    return NextResponse.json({ requiresVerification: true, channel: "bale", destination: normalizedPhone, message: "رمز یک‌بارمصرف در بله ارسال شد" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") return NextResponse.json({ error: "کد قبلاً ارسال شده است؛ یک دقیقه صبر کنید" }, { status: 429 });
    if (error instanceof Error && error.message === "EMAIL_NOT_CONFIGURED") return NextResponse.json({ error: "سرویس ارسال ایمیل هنوز پیکربندی نشده است" }, { status: 503 });
    if (error instanceof Error && error.message === "NOT_BALE_USER") return NextResponse.json({ error: "این شماره حساب بله ندارد" }, { status: 400 });
    if (error instanceof Error && error.message === "BALE_NOT_CONFIGURED") return NextResponse.json({ error: "سرویس بله پیکربندی نشده است" }, { status: 503 });
    console.error("Register error:", error);
    return NextResponse.json({ error: "خطا در ثبت نام" }, { status: 500 });
  }
}
