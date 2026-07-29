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
    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    const images = await prisma.courseImage.findMany({
      where: { courseId: params.id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت تصاویر دوره" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { url, alt, order } = body;

    if (!url) {
      return NextResponse.json({ error: "آدرس تصویر الزامی است" }, { status: 400 });
    }

    const image = await prisma.courseImage.create({
      data: {
        url,
        alt: alt ?? null,
        order: order ?? 0,
        courseId: params.id,
      },
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در افزودن تصویر" }, { status: 500 });
  }
}
