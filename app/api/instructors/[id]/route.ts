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
    const existing = await prisma.instructor.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "استاد پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { bio, expertise, specialties, socialLinks } = body;

    const instructor = await prisma.instructor.update({
      where: { id: params.id },
      data: {
        ...(bio !== undefined && { bio }),
        ...(expertise !== undefined && { expertise }),
        ...(specialties !== undefined && { specialties }),
        ...(socialLinks !== undefined && { socialLinks }),
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

    return NextResponse.json({ instructor });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی استاد" }, { status: 500 });
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
    const existing = await prisma.instructor.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "استاد پیدا نشد" }, { status: 404 });
    }

    await prisma.instructor.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "استاد با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف استاد" }, { status: 500 });
  }
}
