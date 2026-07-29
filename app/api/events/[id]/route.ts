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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        courses: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnail: true,
                price: true,
                level: true,
              },
            },
          },
        },
        instructors: {
          include: {
            instructor: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "رویداد پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت رویداد" }, { status: 500 });
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
    const existing = await prisma.event.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "رویداد پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { title, slug, description, startDate, endDate, location, imageUrl, published, courseIds, instructorIds } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (slug !== undefined) data.slug = slug;
    if (description !== undefined) data.description = description;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (location !== undefined) data.location = location;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (published !== undefined) data.published = published;

    if (courseIds !== undefined) {
      await prisma.eventCourse.deleteMany({ where: { eventId: params.id } });
      if (courseIds.length > 0) {
        await prisma.eventCourse.createMany({
          data: courseIds.map((courseId: string) => ({ eventId: params.id, courseId })),
        });
      }
    }

    if (instructorIds !== undefined) {
      await prisma.eventInstructor.deleteMany({ where: { eventId: params.id } });
      if (instructorIds.length > 0) {
        await prisma.eventInstructor.createMany({
          data: instructorIds.map((instructorId: string) => ({ eventId: params.id, instructorId })),
        });
      }
    }

    const event = await prisma.event.update({
      where: { id: params.id },
      data,
      include: {
        courses: { include: { course: true } },
        instructors: { include: { instructor: { include: { user: { select: { id: true, name: true, avatar: true } } } } } },
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی رویداد" }, { status: 500 });
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
    const existing = await prisma.event.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "رویداد پیدا نشد" }, { status: 404 });
    }

    await prisma.event.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "رویداد با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف رویداد" }, { status: 500 });
  }
}
