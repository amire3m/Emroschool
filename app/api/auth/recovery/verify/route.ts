import prisma from "@/lib/prisma";
import { generateToken, hashPassword } from "@/lib/auth";
import { normalizeIranianPhone, verifyBaleOtp, verifyPhoneOtp } from "@/lib/bale-otp";
import { verifyEmailCode } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { value, method, code, password } = await req.json();
    if (!/^\d{6}$/.test(code || "") || typeof password !== "string" || password.length < 6) return NextResponse.json({ error: "کد معتبر و رمز جدید حداقل ۶ کاراکتری الزامی است" }, { status: 400 });
    const phone = normalizeIranianPhone(value || "");
    const user = method === "email" ? await prisma.user.findUnique({ where: { email: String(value || "").trim().toLowerCase() } }) : await prisma.user.findFirst({ where: { OR: [{ phone }, { balePhone: phone ? `98${phone.slice(1)}` : "" }] } });
    if (!user) return NextResponse.json({ error: "حساب کاربری پیدا نشد" }, { status: 404 });
    const purpose = `reset-${user.id}`;
    const valid = method === "email" ? (await verifyEmailCode(user.email, code, purpose)).valid : method === "bale" ? (await verifyBaleOtp(user.balePhone || user.phone || "", code, purpose)).valid : (method === "sms" || method === "call") ? (await verifyPhoneOtp(user.phone || "", code, purpose, method)).valid : false;
    if (!valid) return NextResponse.json({ error: "کد واردشده صحیح نیست یا منقضی شده است" }, { status: 400 });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
    return NextResponse.json({ token: generateToken({ id: updated.id, email: updated.email, role: updated.role }) });
  } catch { return NextResponse.json({ error: "بازنشانی رمز ناموفق بود" }, { status: 500 }); }
}
