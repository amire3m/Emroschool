import prisma from "@/lib/prisma";
import { generateToken, hashPassword } from "@/lib/auth";
import { issueEmailVerificationCode } from "@/lib/verification";
import { normalizeBalePhone } from "@/lib/bale-otp";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, gender, password, phone, notificationEmailEnabled, notificationChannel } = await req.json();

    if (!email || !name || !gender || !password || !phone) {
      return NextResponse.json({ error: "نام، جنسیت، ایمیل، موبایل و رمز عبور الزامی است" }, { status: 400 });
    }

    const normalizedName = String(name).trim().replace(/\s+/g, " ");
    if (!/^[آ-ی ]+$/.test(normalizedName) || normalizedName.split(" ").filter(Boolean).length < 2) {
      return NextResponse.json({ error: "نام و نام خانوادگی را فقط با حروف فارسی وارد کنید" }, { status: 400 });
    }
    if (!["male", "female"].includes(gender)) return NextResponse.json({ error: "جنسیت را انتخاب کنید" }, { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeBalePhone(phone);
    if (!normalizedPhone) return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });
    if (notificationChannel !== "sms" && notificationChannel !== "bale") {
      return NextResponse.json({ error: "انتخاب یکی از روش‌های پیامکی یا بله الزامی است" }, { status: 400 });
    }
    if (notificationEmailEnabled !== undefined && typeof notificationEmailEnabled !== "boolean") {
      return NextResponse.json({ error: "تنظیم دریافت ایمیل نامعتبر است" }, { status: 400 });
    }
    const preferences = {
      notificationEmailEnabled: notificationEmailEnabled ?? true,
      notificationSmsEnabled: notificationChannel === "sms",
      notificationBaleEnabled: notificationChannel === "bale",
    };
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing?.emailVerified) {
      return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    const user = existing ? await prisma.user.update({ where: { id: existing.id }, data: { name: normalizedName, gender, password: hashed, phone: normalizedPhone, emailVerified: false, phoneVerified: false, registrationCompleted: false, ...preferences } }) : await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        gender,
        password: hashed,
        phone: normalizedPhone,
        role: "user",
        userType: "student",
        profileVisible: false,
        emailVerified: false,
        registrationCompleted: false,
        ...preferences,
      },
    });
    return NextResponse.json({ requiresVerification: true, email: user.email, phone: normalizedPhone, message: "روش تأیید حساب را انتخاب کنید" }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "خطا در ثبت نام" }, { status: 500 });
  }
}
