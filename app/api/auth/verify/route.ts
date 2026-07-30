import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { sendWelcomeEmail, verifyEmailCode } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !/^\d{6}$/.test(code || "")) return NextResponse.json({ error: "ایمیل و کد شش‌رقمی معتبر وارد کنید" }, { status: 400 });
    const result = await verifyEmailCode(email, code);
    if (!result.valid) return NextResponse.json({ error: result.reason === "expired" ? "کد منقضی شده است؛ کد جدید دریافت کنید" : result.reason === "attempts" ? "تعداد تلاش بیش از حد مجاز است؛ کد جدید دریافت کنید" : "کد واردشده صحیح نیست" }, { status: 400 });
    const user = await prisma.user.update({ where: { email: email.trim().toLowerCase() }, data: { emailVerified: true } });
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    await sendWelcomeEmail(user.email, user.name).catch((error) => console.error("Welcome email error:", error));
    return NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "خطا در تأیید ایمیل" }, { status: 500 });
  }
}
