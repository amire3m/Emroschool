import prisma from "@/lib/prisma";
import { issueBaleOtp, normalizeBalePhone } from "@/lib/bale-otp";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phone, purpose } = await req.json();
    if (!['login', 'reset'].includes(purpose)) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    const normalized = normalizeBalePhone(phone || "");
    if (!normalized) return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { phone: { in: [normalized, `0${normalized.slice(2)}`] } } });
    if (!user) return NextResponse.json({ error: "حسابی با این شماره موبایل پیدا نشد" }, { status: 404 });
    await issueBaleOtp(normalized, purpose);
    return NextResponse.json({ message: "رمز یک‌بارمصرف در بله ارسال شد" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errors: Record<string, [string, number]> = { RATE_LIMIT: ["برای ارسال مجدد یک دقیقه صبر کنید", 429], NOT_BALE_USER: ["این شماره حساب بله ندارد", 400], INVALID_PHONE: ["شماره موبایل معتبر وارد کنید", 400], BALE_NOT_CONFIGURED: ["سرویس بله پیکربندی نشده است", 503] };
    const [text, status] = errors[message] || ["ارسال رمز یک‌بارمصرف ناموفق بود", 502];
    return NextResponse.json({ error: text }, { status });
  }
}
