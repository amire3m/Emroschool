import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  try {
    let settings = await prisma.siteSetting.findFirst();
    if (!settings) {
      settings = await prisma.siteSetting.create({
        data: {},
      });
    }
    return NextResponse.json(settings);
  } catch (e) {
    console.error("Settings GET error:", e);
    return NextResponse.json({ error: "خطا در دریافت تنظیمات" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text) return NextResponse.json({ error: "بدنه خالی است" }, { status: 400 });

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "JSON نامعتبر" }, { status: 400 });
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "ورود الزامی است" }, { status: 401 });
    const user = verifyToken(token);
    if (!user || user.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id, updatedAt, createdAt, ...clean } = body;

    const existing = await prisma.siteSetting.findFirst();
    if (!existing) {
      await prisma.siteSetting.create({ data: clean });
    } else {
      await prisma.siteSetting.update({ where: { id: existing.id }, data: clean });
    }

    const updated = await prisma.siteSetting.findFirst();
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Settings PUT error:", e);
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات" }, { status: 500 });
  }
}
