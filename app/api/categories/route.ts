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
    const categories = await prisma.category.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { courses: true } },
      },
    });

    const result = categories.map((cat) => ({
      ...cat,
      courseCount: cat._count.courses,
      _count: undefined,
    }));

    return NextResponse.json({ categories: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت دسته‌بندی‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, slug, description, icon, order } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "نام و اسلاگ الزامی است" }, { status: 400 });
    }

    const existing = await prisma.category.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) {
      return NextResponse.json({ error: "دسته‌بندی با این نام یا اسلاگ وجود دارد" }, { status: 409 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description ?? null,
        icon: icon ?? null,
        order: order ?? 0,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد دسته‌بندی" }, { status: 500 });
  }
}
