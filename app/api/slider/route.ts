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
    const slides = await prisma.slider.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ slides });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت اسلایدها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, subtitle, imageUrl, linkUrl, linkText, order, published } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "آدرس تصویر الزامی است" }, { status: 400 });
    }

    const slide = await prisma.slider.create({
      data: {
        title: title ?? null,
        subtitle: subtitle ?? null,
        imageUrl,
        linkUrl: linkUrl ?? null,
        linkText: linkText ?? null,
        order: order ?? 0,
        published: published ?? false,
      },
    });

    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد اسلاید" }, { status: 500 });
  }
}
