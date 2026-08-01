import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { sendWelcomeEmail, verifyEmailCode } from "@/lib/verification";
import { verifyBaleOtp } from "@/lib/bale-otp";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, phone, code, channel = "email" } = await req.json();
    if (channel === "bale") {
      if (!/^\d{6}$/.test(code || "")) return NextResponse.json({ error: "کد شش‌رقمی معتبر وارد کنید" }, { status: 400 });
      const result = await verifyBaleOtp(phone || "", code, "register");
      if (!result.valid) return NextResponse.json({ error: result.reason === "expired" ? "کد منقضی شده است" : result.reason === "attempts" ? "تعداد تلاش بیش از حد مجاز است" : "کد واردشده صحیح نیست" }, { status: 400 });
      const user = await prisma.user.findFirst({ where: { phone: { in: [result.phone, `0${result.phone.slice(2)}`] } } });
      if (!user) return NextResponse.json({ error: "حساب کاربری پیدا نشد" }, { status: 404 });
      await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      await sendWelcomeEmail(user.email, user.name).catch(() => {});
      return NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    }
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
