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
    const events = await prisma.event.findMany({
      include: {
        _count: { select: { courses: true, instructors: true } },
      },
      orderBy: { startDate: "desc" },
    });

    const result = events.map((event) => ({
      ...event,
      courseCount: event._count.courses,
      instructorCount: event._count.instructors,
      _count: undefined,
    }));

    return NextResponse.json({ events: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت رویدادها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, slug, description, startDate, endDate, location, imageUrl, published, courseIds, instructorIds } = body;

    if (!title || !slug || !description || !startDate) {
      return NextResponse.json({ error: "عنوان، اسلاگ، توضیحات و تاریخ شروع الزامی است" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        slug,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location ?? null,
        imageUrl: imageUrl ?? null,
        published: published ?? false,
        courses: courseIds?.length
          ? { create: courseIds.map((courseId: string) => ({ courseId })) }
          : undefined,
        instructors: instructorIds?.length
          ? { create: instructorIds.map((instructorId: string) => ({ instructorId })) }
          : undefined,
      },
      include: {
        courses: { include: { course: true } },
        instructors: { include: { instructor: { include: { user: { select: { id: true, name: true, avatar: true } } } } } },
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد رویداد" }, { status: 500 });
  }
}
