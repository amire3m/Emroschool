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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        gallery: true,
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت دوره" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const existing = await prisma.course.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      slug,
      description,
      price,
      oldPrice,
      instructor,
      categoryId,
      categoryName,
      level,
      thumbnail,
      videoUrl,
      duration,
      published,
      featured,
    } = body;

    const category = categoryId
      ? await prisma.category.findUnique({ where: { id: categoryId } })
      : null;
    if (categoryId && !category) {
      return NextResponse.json({ error: "دسته‌بندی انتخاب‌شده پیدا نشد" }, { status: 400 });
    }

    const course = await prisma.course.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(oldPrice !== undefined && { oldPrice }),
        ...(instructor !== undefined && { instructor }),
        ...(categoryId !== undefined && { categoryId: category?.id ?? null }),
        ...(categoryId !== undefined
          ? { categoryName: category?.name ?? null }
          : categoryName !== undefined && { categoryName }),
        ...(level !== undefined && { level }),
        ...(thumbnail !== undefined && { thumbnail }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(duration !== undefined && { duration }),
        ...(published !== undefined && { published }),
        ...(featured !== undefined && { featured }),
      },
    });

    return NextResponse.json({ course });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی دوره" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const existing = await prisma.course.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    await prisma.gallery.deleteMany({ where: { courseId: params.id } });
    await prisma.enrollment.deleteMany({ where: { courseId: params.id } });
    await prisma.course.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "دوره با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف دوره" }, { status: 500 });
  }
}
