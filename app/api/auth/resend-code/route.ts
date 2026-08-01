import prisma from "@/lib/prisma";
import { issueEmailVerificationCode } from "@/lib/verification";
import { issueBaleOtp } from "@/lib/bale-otp";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, phone, channel = "email" } = await req.json();
    const normalized = String(email || "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user) return NextResponse.json({ error: "درخواست تأیید معتبری پیدا نشد" }, { status: 400 });
    if (channel === "bale") {
      await issueBaleOtp(phone || user.phone || "", "register");
      return NextResponse.json({ message: "رمز جدید در بله ارسال شد" });
    }
    if (user.emailVerified) return NextResponse.json({ error: "درخواست تأیید معتبری پیدا نشد" }, { status: 400 });
    await issueEmailVerificationCode(normalized, user.name);
    return NextResponse.json({ message: "کد جدید ارسال شد" });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") return NextResponse.json({ error: "برای ارسال مجدد کد یک دقیقه صبر کنید" }, { status: 429 });
    if (error instanceof Error && error.message === "EMAIL_NOT_CONFIGURED") return NextResponse.json({ error: "سرویس ارسال ایمیل هنوز پیکربندی نشده است" }, { status: 503 });
    if (error instanceof Error && error.message === "NOT_BALE_USER") return NextResponse.json({ error: "این شماره حساب بله ندارد؛ شماره دیگری وارد کنید" }, { status: 400 });
    if (error instanceof Error && error.message === "INVALID_PHONE") return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });
    if (error instanceof Error && error.message === "BALE_NOT_CONFIGURED") return NextResponse.json({ error: "سرویس بله پیکربندی نشده است" }, { status: 503 });
    return NextResponse.json({ error: "خطا در ارسال مجدد کد" }, { status: 500 });
  }
}
