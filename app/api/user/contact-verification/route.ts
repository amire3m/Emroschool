import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { issueBaleOtp, issuePhoneOtp, normalizeBalePhone, normalizeIranianPhone, verifyBaleOtp, verifyPhoneOtp } from "@/lib/bale-otp";
import { issueEmailVerificationCode, verifyEmailCode } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

function getUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
}

const errorResponse = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";
  const errors: Record<string, [string, number]> = { RATE_LIMIT: ["برای ارسال مجدد یک دقیقه صبر کنید", 429], NOT_BALE_USER: ["این شماره حساب بله ندارد", 400], INVALID_PHONE: ["شماره موبایل معتبر وارد کنید", 400], BALE_NOT_CONFIGURED: ["سرویس بله پیکربندی نشده است", 503], SMS_NOT_CONFIGURED: ["سرویس پیامک پیکربندی نشده است", 503] };
  const [message, status] = errors[code] || ["ارسال کد ناموفق بود", 502];
  return NextResponse.json({ error: message }, { status });
};

export async function POST(req: NextRequest) {
  const payload = getUser(req);
  if (!payload) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  try {
    const { field, value, method } = await req.json();
    if (!['email', 'phone'].includes(field)) return NextResponse.json({ error: "فیلد نامعتبر است" }, { status: 400 });
    const purpose = `profile-${field}-${payload.id}`;
    if (field === "email") {
      if (method !== "email" || !/^\S+@\S+\.\S+$/.test(value || "")) return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });
      const existing = await prisma.user.findFirst({ where: { email: String(value).trim().toLowerCase(), NOT: { id: payload.id } } });
      if (existing) return NextResponse.json({ error: "این ایمیل برای حساب دیگری ثبت شده است" }, { status: 409 });
      await issueEmailVerificationCode(String(value).trim().toLowerCase(), "کاربر", purpose);
    } else if (method === "bale") {
      await issueBaleOtp(normalizeBalePhone(value || ""), purpose as "register");
    } else if (method === "sms" || method === "call") {
      await issuePhoneOtp(value || "", purpose, method);
    } else return NextResponse.json({ error: "روش تأیید نامعتبر است" }, { status: 400 });
    return NextResponse.json({ message: "کد تأیید ارسال شد" });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(req: NextRequest) {
  const payload = getUser(req);
  if (!payload) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  try {
    const { field, value, method, code } = await req.json();
    const purpose = `profile-${field}-${payload.id}`;
    if (!/^\d{6}$/.test(code || "")) return NextResponse.json({ error: "کد شش‌رقمی معتبر وارد کنید" }, { status: 400 });
    let valid = false;
    if (field === "email" && method === "email") valid = (await verifyEmailCode(value, code, purpose)).valid;
    if (field === "phone" && method === "bale") valid = (await verifyBaleOtp(value, code, purpose as "register")).valid;
    if (field === "phone" && (method === "sms" || method === "call")) valid = (await verifyPhoneOtp(value, code, purpose, method)).valid;
    if (!valid) return NextResponse.json({ error: "کد واردشده صحیح نیست یا منقضی شده است" }, { status: 400 });
    const data = field === "email" ? { email: String(value).trim().toLowerCase(), emailVerified: true } : method === "bale" ? { phone: normalizeBalePhone(value), balePhone: normalizeBalePhone(value), phoneVerified: true } : { phone: normalizeIranianPhone(value), phoneVerified: true };
    const user = await prisma.user.update({ where: { id: payload.id }, data, select: { email: true, emailVerified: true, phone: true, phoneVerified: true, balePhone: true } });
    return NextResponse.json({ user });
  } catch (error) { return errorResponse(error); }
}
