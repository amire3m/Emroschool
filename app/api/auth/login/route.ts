import prisma from "@/lib/prisma";
import { verifyPassword, generateToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "ایمیل و رمز عبور الزامی است" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }
    if (!user.emailVerified && !user.phoneVerified && !user.balePhone) return NextResponse.json({ error: "حساب شما هنوز تأیید نشده است", verificationRequired: true, email: user.email }, { status: 403 });

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ورود" }, { status: 500 });
  }
}
