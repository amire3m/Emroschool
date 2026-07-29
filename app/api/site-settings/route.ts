import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  try {
    let settings = await prisma.siteSetting.findFirst();
    if (!settings) {
      settings = await prisma.siteSetting.create({
        data: { siteName: "آکادمی هنر و رسانه امام روح‌الله (ره)" },
      });
    }
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "خطا در دریافت تنظیمات" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "ورود الزامی است" }, { status: 401 });
    const user = verifyToken(token);
    if (!user || user.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();
    const existing = await prisma.siteSetting.findFirst();
    if (!existing) {
      await prisma.siteSetting.create({
        data: { siteName: "آکادمی هنر و رسانه امام روح‌الله (ره)", ...body },
      });
    } else {
      await prisma.siteSetting.update({
        where: { id: existing.id },
        data: body,
      });
    }
    const updated = await prisma.siteSetting.findFirst();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات" }, { status: 500 });
  }
}
