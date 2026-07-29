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
    const instructors = await prisma.instructor.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            bio: true,
            expertise: true,
          },
        },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = instructors.map((inst) => ({
      ...inst,
      eventCount: inst._count.events,
      _count: undefined,
    }));

    return NextResponse.json({ instructors: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت اساتید" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, bio, expertise, specialties } = body;

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    const existing = await prisma.instructor.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json({ error: "این کاربر قبلاً به عنوان استاد ثبت شده است" }, { status: 409 });
    }

    const instructor = await prisma.instructor.create({
      data: {
        userId,
        bio: bio ?? null,
        expertise: expertise ?? null,
        specialties: specialties ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({ instructor }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد استاد" }, { status: 500 });
  }
}
