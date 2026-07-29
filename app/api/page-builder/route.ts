import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const payload = verifyToken(authHeader.slice(7));
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

export async function GET() {
  try {
    const sections = await prisma.pageSection.findMany({
      orderBy: { updatedAt: "desc" },
    });

    const map: Record<string, string> = {};
    for (const section of sections) {
      map[section.slug] = section.content;
    }

    return NextResponse.json({ sections: map });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت بخش‌ها" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { slug, content, order, visible } = body;

    if (!slug || content === undefined) {
      return NextResponse.json({ error: "اسلاگ و محتوا الزامی است" }, { status: 400 });
    }

    const data: Record<string, unknown> = { content };
    if (order !== undefined) data.order = order;
    if (visible !== undefined) data.visible = visible;

    const section = await prisma.pageSection.upsert({
      where: { slug },
      update: data,
      create: { slug, content, ...(order !== undefined && { order }), ...(visible !== undefined && { visible }) },
    });

    return NextResponse.json({ section });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ذخیره بخش" }, { status: 500 });
  }
}
