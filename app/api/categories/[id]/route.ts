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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const existing = await prisma.category.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { name, slug, description, icon, order } = body;

    if (name || slug) {
      const conflict = await prisma.category.findFirst({
        where: {
          OR: [
            ...(name ? [{ name }] : []),
            ...(slug ? [{ slug }] : []),
          ],
          NOT: { id: params.id },
        },
      });
      if (conflict) {
        return NextResponse.json({ error: "نام یا اسلاگ تکراری است" }, { status: 409 });
      }
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی دسته‌بندی" }, { status: 500 });
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
    const existing = await prisma.category.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    await prisma.category.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "دسته‌بندی با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف دسته‌بندی" }, { status: 500 });
  }
}
