import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const payload = verifyToken(authHeader.slice(7));
  return payload;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  }

  try {
    const { courseId } = await req.json();

    if (!courseId) {
      return NextResponse.json({ error: "شناسه دوره الزامی است" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });

    if (existing) {
      return NextResponse.json({ error: "قبلاً در این دوره ثبت نام کرده‌اید" }, { status: 409 });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId,
        progress: 0,
        completed: false,
      },
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ثبت نام" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  }

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user.id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            price: true,
            instructor: true,
            category: true,
            level: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ enrollments });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت دوره‌های ثبت نامی" }, { status: 500 });
  }
}
