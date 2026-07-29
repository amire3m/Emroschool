import prisma from "@/lib/prisma";
import { hashPassword, generateToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, phone } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json({ error: "ایمیل، نام و رمز عبور الزامی است" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        phone: phone || null,
        role: "user",
        userType: "student",
        profileVisible: false,
      },
    });

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        userType: user.userType,
        phone: user.phone,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ثبت نام" }, { status: 500 });
  }
}
