import prisma from "@/lib/prisma";
import { isAdminRole, verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const payload = verifyToken(authHeader.slice(7));
  if (!payload || !isAdminRole(payload.role)) return null;
  return payload;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryName = searchParams.get("categoryName");
    const level = searchParams.get("level");

    const where: Record<string, unknown> = {};
    if (categoryName) where.categoryName = categoryName;
    if (level) where.level = level;

    const courses = await prisma.course.findMany({
      where,
      include: {
        _count: { select: { gallery: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = courses.map((course) => ({
      ...course,
      galleryCount: course._count.gallery,
      _count: undefined,
    }));

    return NextResponse.json({ courses: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت دوره‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title,
      slug,
      description,
      price,
      oldPrice,
      instructor,
      categoryName,
      level,
      thumbnail,
      videoUrl,
      duration,
      published,
      featured,
    } = body;

    if (!title || !slug || !description) {
      return NextResponse.json({ error: "عنوان، اسلاگ و توضیحات الزامی است" }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description,
        price: price ?? 0,
        oldPrice: oldPrice ?? null,
        instructor: instructor ?? null,
        categoryName: categoryName ?? null,
        level: level ?? null,
        thumbnail: thumbnail ?? null,
        videoUrl: videoUrl ?? null,
        duration: duration ?? null,
        published: published ?? false,
        featured: featured ?? false,
      },
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد دوره" }, { status: 500 });
  }
}
