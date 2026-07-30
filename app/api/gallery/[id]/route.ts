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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAdminUser(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const body = await req.json();
    if (!body.title?.trim() || !body.slug?.trim()) return NextResponse.json({ error: "عنوان و آدرس انگلیسی الزامی است" }, { status: 400 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) return NextResponse.json({ error: "آدرس باید انگلیسی و با خط تیره باشد" }, { status: 400 });
    if (await prisma.gallery.findFirst({ where: { slug: body.slug, NOT: { id: params.id } } })) return NextResponse.json({ error: "این آدرس قبلاً استفاده شده است" }, { status: 409 });
    const image = await prisma.gallery.update({ where: { id: params.id }, data: { imageUrl: body.imageUrl, title: body.title.trim(), slug: body.slug.trim(), description: body.description?.trim() || null, altText: body.altText?.trim() || null, seoTitle: body.title.trim(), seoDescription: body.description?.trim() || null, capturedAt: body.capturedAt ? new Date(body.capturedAt) : null, folder: body.folder?.trim() || null, courseId: body.courseId || null } });
    return NextResponse.json({ image });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این آدرس قبلاً استفاده شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در ویرایش تصویر" }, { status: 500 });
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
    const existing = await prisma.gallery.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "تصویر پیدا نشد" }, { status: 404 });
    }

    await prisma.gallery.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "تصویر با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف تصویر" }, { status: 500 });
  }
}
