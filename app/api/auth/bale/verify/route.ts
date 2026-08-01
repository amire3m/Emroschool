import prisma from "@/lib/prisma";
import { generateToken, hashPassword } from "@/lib/auth";
import { verifyBaleOtp } from "@/lib/bale-otp";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phone, code, purpose, password } = await req.json();
    if (!['login', 'reset'].includes(purpose) || !/^\d{6}$/.test(code || "")) return NextResponse.json({ error: "کد شش‌رقمی معتبر وارد کنید" }, { status: 400 });
    const result = await verifyBaleOtp(phone || "", code, purpose);
    if (!result.valid) return NextResponse.json({ error: result.reason === "expired" ? "کد منقضی شده است" : result.reason === "attempts" ? "تعداد تلاش بیش از حد مجاز است" : "کد واردشده صحیح نیست" }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { phone: { in: [result.phone, `0${result.phone.slice(2)}`] } } });
    if (!user) return NextResponse.json({ error: "حساب کاربری پیدا نشد" }, { status: 404 });
    if (purpose === "reset") {
      if (typeof password !== "string" || password.length < 6) return NextResponse.json({ error: "رمز جدید باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
      await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password), phoneVerified: true } });
    }
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    return NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch {
    return NextResponse.json({ error: "تأیید رمز یک‌بارمصرف ناموفق بود" }, { status: 500 });
  }
}
