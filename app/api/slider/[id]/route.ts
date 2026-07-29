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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const existing = await prisma.slider.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "اسلاید پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { title, subtitle, imageUrl, linkUrl, linkText, order, published } = body;

    const slide = await prisma.slider.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(linkText !== undefined && { linkText }),
        ...(order !== undefined && { order }),
        ...(published !== undefined && { published }),
      },
    });

    return NextResponse.json({ slide });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی اسلاید" }, { status: 500 });
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
    const existing = await prisma.slider.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "اسلاید پیدا نشد" }, { status: 404 });
    }

    await prisma.slider.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "اسلاید با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف اسلاید" }, { status: 500 });
  }
}
