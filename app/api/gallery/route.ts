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
    const { imageUrl, title, slug, description, altText, seoTitle, seoDescription, capturedAt, folder, courseId } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "آدرس تصویر الزامی است" }, { status: 400 });
    }
    if (!title?.trim() || !slug?.trim()) return NextResponse.json({ error: "عنوان و آدرس انگلیسی تصویر الزامی است" }, { status: 400 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "آدرس باید انگلیسی و با خط تیره باشد" }, { status: 400 });
    if (await prisma.gallery.findFirst({ where: { slug } })) return NextResponse.json({ error: "این آدرس قبلاً استفاده شده است" }, { status: 409 });

    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) {
        return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
      }
    }

    const image = await prisma.gallery.create({
      data: {
        imageUrl,
        title: title.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        altText: altText || null,
        seoTitle: seoTitle?.trim() || null,
        seoDescription: seoDescription?.trim() || null,
        capturedAt: capturedAt ? new Date(capturedAt) : null,
        folder: folder || null,
        courseId: courseId || null,
      },
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این آدرس قبلاً استفاده شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در ایجاد گالری" }, { status: 500 });
  }
}
