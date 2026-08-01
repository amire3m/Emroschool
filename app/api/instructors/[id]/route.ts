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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, avatar: true, bio: true, expertise: true, socialLinks: true } },
        courses: { where: { published: true }, select: { id: true, title: true, slug: true, thumbnail: true, description: true, price: true, scheduleStatus: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!instructor || !instructor.showOnSite) return NextResponse.json({ error: "استاد پیدا نشد" }, { status: 404 });
    return NextResponse.json({ instructor });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت اطلاعات استاد" }, { status: 500 });
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
    const existing = await prisma.instructor.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "استاد پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { userId, name, bio, expertise, specialties, socialLinks, avatar, showOnSite } = body;

    if (userId) {
      const linked = await prisma.instructor.findUnique({ where: { userId } });
      if (linked && linked.id !== params.id) {
        return NextResponse.json({ error: "این کاربر قبلاً به استاد دیگری متصل شده است" }, { status: 409 });
      }
    }

    const instructor = await prisma.instructor.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(expertise !== undefined && { expertise }),
        ...(specialties !== undefined && { specialties }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(avatar !== undefined && { avatar }),
        ...(showOnSite !== undefined && { showOnSite }),
        ...(userId !== undefined && { userId: userId || null }),
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

    if (userId) await prisma.user.update({ where: { id: userId }, data: { userType: "instructor" } });

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
