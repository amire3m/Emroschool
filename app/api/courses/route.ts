import prisma from "@/lib/prisma";
import { isAdminRole, verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import { sortCoursesBySchedule } from "@/lib/course-order";

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const payload = verifyToken(authHeader.slice(7));
  if (!payload || !isAdminRole(payload.role)) return null;
  return payload;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req);
    const { searchParams } = new URL(req.url);
    const categoryName = searchParams.get("categoryName");
    const level = searchParams.get("level");

    const where: Record<string, unknown> = admin ? {} : { published: true };
    if (categoryName) where.categoryName = categoryName;
    if (level) where.level = level;

    const courses = await prisma.course.findMany({
      where,
      include: {
        parent: { select: { id: true, title: true, slug: true } },
        instructorProfile: { select: { id: true, profileSlug: true, name: true, avatar: true, bio: true, expertise: true, user: { select: { id: true, name: true, avatar: true, bio: true, expertise: true } } } },
        instructors: { include: { instructor: { select: { id: true, profileSlug: true, name: true, avatar: true, expertise: true, user: { select: { id: true, name: true, avatar: true, expertise: true } } } } } },
        _count: { select: { gallery: true, children: true, enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = sortCoursesBySchedule(courses).map((course) => ({
      ...course,
      galleryCount: course._count.gallery,
      childCount: course._count.children,
      enrollmentCount: course._count.enrollments,
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
      instructorId,
      instructorIds,
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
      deliveryModes,
      parentId,
    } = body;

    if (!title || !slug || !description) {
      return NextResponse.json({ error: "عنوان، اسلاگ و توضیحات الزامی است" }, { status: 400 });
    }
    if (!["comprehensive", "single"].includes(courseType)) return NextResponse.json({ error: "نوع دوره نامعتبر است" }, { status: 400 });
    if (!["upcoming", "completed"].includes(scheduleStatus)) return NextResponse.json({ error: "وضعیت زمانی دوره نامعتبر است" }, { status: 400 });
    if (!["purchase", "registration"].includes(registrationMode)) return NextResponse.json({ error: "روش ثبت‌نام نامعتبر است" }, { status: 400 });
    const selectedDeliveryModes = Array.isArray(deliveryModes) ? [...new Set(deliveryModes.filter((mode: unknown): mode is string => mode === "in_person" || mode === "virtual"))] : ["in_person"];
    if (!selectedDeliveryModes.length) return NextResponse.json({ error: "حداقل یک شیوه برگزاری را انتخاب کنید" }, { status: 400 });
    if (courseType === "comprehensive" && parentId) return NextResponse.json({ error: "دوره جامع نمی‌تواند فرزند دوره دیگری باشد" }, { status: 400 });
    if (courseType === "comprehensive" && published) return NextResponse.json({ error: "ابتدا دوره جامع را به‌صورت پیش‌نویس بسازید، حداقل یک دوره فرزند به آن متصل کنید و سپس منتشر کنید" }, { status: 400 });
    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;
    if (scheduleStatus === "upcoming" && (!parsedStartDate || Number.isNaN(parsedStartDate.getTime()))) return NextResponse.json({ error: "تاریخ شروع دوره آینده الزامی است" }, { status: 400 });
    if (scheduleStatus === "completed" && (!parsedEndDate || Number.isNaN(parsedEndDate.getTime()))) return NextResponse.json({ error: "تاریخ پایان دوره برگزارشده الزامی است" }, { status: 400 });
    const parent = parentId ? await prisma.course.findUnique({ where: { id: parentId } }) : null;
    if (parentId && (!parent || parent.courseType !== "comprehensive")) return NextResponse.json({ error: "دوره والد باید یک دوره جامع معتبر باشد" }, { status: 400 });

    const category = categoryId
      ? await prisma.category.findUnique({ where: { id: categoryId } })
      : null;
    if (categoryId && !category) {
      return NextResponse.json({ error: "دسته‌بندی انتخاب‌شده پیدا نشد" }, { status: 400 });
    }
    const selectedInstructorIds = Array.isArray(instructorIds) ? [...new Set(instructorIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))] : instructorId ? [instructorId] : [];
    const instructorProfiles = selectedInstructorIds.length ? await prisma.instructor.findMany({ where: { id: { in: selectedInstructorIds } }, include: { user: { select: { name: true } } } }) : [];
    if (instructorProfiles.length !== selectedInstructorIds.length) return NextResponse.json({ error: "یکی از مدرس‌های انتخاب‌شده پیدا نشد" }, { status: 400 });
    const primaryInstructor = instructorProfiles[0] || null;

    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description,
        price: price ?? 0,
        oldPrice: oldPrice ?? null,
        instructor: instructorProfiles.length ? instructorProfiles.map((profile) => profile.name || profile.user?.name).filter(Boolean).join("، ") : instructor || null,
        instructorId: primaryInstructor?.id ?? null,
        instructors: selectedInstructorIds.length ? { create: selectedInstructorIds.map((instructorId) => ({ instructorId })) } : undefined,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? categoryName ?? null,
        level: level ?? null,
        thumbnail: thumbnail ?? null,
        videoUrl: videoUrl ?? null,
        duration: duration ?? null,
        published: published ?? false,
        featured: featured ?? false,
        courseType,
        scheduleStatus,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        registrationMode,
        deliveryModes: selectedDeliveryModes.join(","),
        parentId: courseType === "single" ? parentId || null : null,
      },
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "آدرس این دوره قبلاً استفاده شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در ایجاد دوره" }, { status: 500 });
  }
}
