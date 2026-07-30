import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { issueEmailVerificationCode } from "@/lib/verification";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, phone } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json({ error: "ایمیل، نام و رمز عبور الزامی است" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing?.emailVerified) {
      return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    const user = existing ? await prisma.user.update({ where: { id: existing.id }, data: { name: name.trim(), password: hashed, emailVerified: false } }) : await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashed,
        phone: phone || null,
        role: "user",
        userType: "student",
        profileVisible: false,
        emailVerified: false,
      },
    });
    await issueEmailVerificationCode(user.email, user.name);
    return NextResponse.json({ requiresVerification: true, channel: "email", destination: user.email, message: "کد تأیید به ایمیل شما ارسال شد" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") return NextResponse.json({ error: "کد قبلاً ارسال شده است؛ یک دقیقه صبر کنید" }, { status: 429 });
    if (error instanceof Error && error.message === "EMAIL_NOT_CONFIGURED") return NextResponse.json({ error: "سرویس ارسال ایمیل هنوز پیکربندی نشده است" }, { status: 503 });
    console.error("Register error:", error);
    return NextResponse.json({ error: "خطا در ثبت نام" }, { status: 500 });
  }
}
