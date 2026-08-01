import prisma from "@/lib/prisma";
import { issueBaleOtp, issuePhoneOtp, normalizeIranianPhone } from "@/lib/bale-otp";
import { issueEmailVerificationCode } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { value, method } = await req.json();
    const isEmail = method === "email";
    const normalizedPhone = normalizeIranianPhone(value || "");
    const user = isEmail ? await prisma.user.findUnique({ where: { email: String(value || "").trim().toLowerCase() } }) : await prisma.user.findFirst({ where: { OR: [{ phone: normalizedPhone }, { balePhone: normalizedPhone ? `98${normalizedPhone.slice(1)}` : "" }] } });
    if (!user) return NextResponse.json({ error: "حسابی با این اطلاعات پیدا نشد" }, { status: 404 });
    const purpose = `reset-${user.id}`;
    if (method === "email") await issueEmailVerificationCode(user.email, user.name, purpose);
    else if (method === "bale") await issueBaleOtp(user.balePhone || user.phone || "", purpose);
    else if (method === "sms" || method === "call") await issuePhoneOtp(user.phone || "", purpose, method);
    else return NextResponse.json({ error: "روش بازیابی نامعتبر است" }, { status: 400 });
    return NextResponse.json({ message: "کد بازیابی ارسال شد" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { RATE_LIMIT: "برای ارسال مجدد یک دقیقه صبر کنید", NOT_BALE_USER: "این شماره حساب بله ندارد", INVALID_PHONE: "شماره موبایل معتبر نیست" };
    return NextResponse.json({ error: messages[code] || "ارسال کد بازیابی ناموفق بود" }, { status: code === "RATE_LIMIT" ? 429 : 502 });
  }
}
