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
    const admin = await getAdminUser(req);
    const course = await prisma.course.findUnique({
      where: { id: params.id, ...(admin ? {} : { published: true }) },
      include: {
        gallery: true,
        parent: { select: { id: true, title: true, slug: true } },
        children: { where: admin ? undefined : { published: true }, select: { id: true, title: true, slug: true, thumbnail: true, scheduleStatus: true, startDate: true } },
        _count: { select: { enrollments: true, applications: true, children: true } },
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
    const existing = await prisma.course.findUnique({ where: { id: params.id }, include: { _count: { select: { children: true } } } });
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
      courseType,
      scheduleStatus,
      startDate,
      endDate,
      registrationMode,
      parentId,
    } = body;

    const nextCourseType = courseType ?? existing.courseType;
    const nextScheduleStatus = scheduleStatus ?? existing.scheduleStatus;
    const nextRegistrationMode = registrationMode ?? existing.registrationMode;
    const nextPublished = published ?? existing.published;
    const nextParentId = parentId !== undefined ? parentId || null : existing.parentId;
    if (!["comprehensive", "single"].includes(nextCourseType)) return NextResponse.json({ error: "نوع دوره نامعتبر است" }, { status: 400 });
    if (!["upcoming", "completed"].includes(nextScheduleStatus)) return NextResponse.json({ error: "وضعیت زمانی دوره نامعتبر است" }, { status: 400 });
    if (!["purchase", "registration"].includes(nextRegistrationMode)) return NextResponse.json({ error: "روش ثبت‌نام نامعتبر است" }, { status: 400 });
    if (nextCourseType === "comprehensive" && nextParentId) return NextResponse.json({ error: "دوره جامع نمی‌تواند فرزند دوره دیگری باشد" }, { status: 400 });
    if (nextCourseType === "single" && existing._count.children > 0) return NextResponse.json({ error: "این دوره دارای فرزند است و تا زمان جداسازی آن‌ها نمی‌تواند به دوره عادی تبدیل شود" }, { status: 400 });
    if (nextCourseType === "comprehensive" && nextPublished && existing._count.children === 0) return NextResponse.json({ error: "دوره جامع برای انتشار باید حداقل یک دوره فرزند داشته باشد" }, { status: 400 });
    if (nextParentId === params.id) return NextResponse.json({ error: "یک دوره نمی‌تواند والد خودش باشد" }, { status: 400 });
    const parent = nextParentId ? await prisma.course.findUnique({ where: { id: nextParentId } }) : null;
    if (nextParentId && (!parent || parent.courseType !== "comprehensive")) return NextResponse.json({ error: "دوره والد باید یک دوره جامع معتبر باشد" }, { status: 400 });
    if (existing.parentId && existing.parentId !== nextParentId) {
      const oldParent = await prisma.course.findUnique({ where: { id: existing.parentId }, include: { _count: { select: { children: true } } } });
      if (oldParent?.published && oldParent._count.children <= 1) return NextResponse.json({ error: "این دوره تنها فرزند والد منتشرشده است؛ ابتدا فرزند دیگری به دوره جامع متصل کنید" }, { status: 400 });
    }
    const parsedStartDate = startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate;
    const parsedEndDate = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate;
    if (nextScheduleStatus === "upcoming" && (!parsedStartDate || Number.isNaN(parsedStartDate.getTime()))) return NextResponse.json({ error: "تاریخ شروع دوره آینده الزامی است" }, { status: 400 });
    if (nextScheduleStatus === "completed" && (!parsedEndDate || Number.isNaN(parsedEndDate.getTime()))) return NextResponse.json({ error: "تاریخ پایان دوره برگزارشده الزامی است" }, { status: 400 });

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
        courseType: nextCourseType,
        scheduleStatus: nextScheduleStatus,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        registrationMode: nextRegistrationMode,
        parentId: nextCourseType === "single" ? nextParentId : null,
      },
    });

    return NextResponse.json({ course });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "آدرس این دوره قبلاً استفاده شده است" }, { status: 409 });
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
    if (existing.parentId) {
      const parent = await prisma.course.findUnique({ where: { id: existing.parentId }, include: { _count: { select: { children: true } } } });
      if (parent?.published && parent._count.children <= 1) return NextResponse.json({ error: "این دوره تنها فرزند والد منتشرشده است و قابل حذف نیست" }, { status: 400 });
    }

    await prisma.gallery.deleteMany({ where: { courseId: params.id } });
    await prisma.enrollment.deleteMany({ where: { courseId: params.id } });
    await prisma.course.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "دوره با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف دوره" }, { status: 500 });
  }
}
