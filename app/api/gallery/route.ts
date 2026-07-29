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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const folder = searchParams.get("folder");

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (folder) where.folder = folder;

    const images = await prisma.gallery.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت گالری" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { imageUrl, altText, folder, courseId } = await req.json();

    if (!imageUrl || !courseId) {
      return NextResponse.json({ error: "آدرس تصویر و شناسه دوره الزامی است" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    }

    const image = await prisma.gallery.create({
      data: {
        imageUrl,
        altText: altText || null,
        folder: folder || null,
        courseId,
      },
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد گالری" }, { status: 500 });
  }
}
