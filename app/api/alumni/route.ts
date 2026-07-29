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

export async function GET() {
  try {
    const alumni = await prisma.alumni.findMany({
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ alumni });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت هنرآموختگان" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, name, field, batch, quote, imageUrl, achievements, order, showOnSite } = body;

    if (!name) {
      return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
    }

    const alumni = await prisma.$transaction(async (tx) => {
      if (userId) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");
        const linked = await tx.alumni.findUnique({ where: { userId } });
        if (linked) throw new Error("ALREADY_LINKED");
        await tx.user.update({ where: { id: userId }, data: { userType: "alumni" } });
      }
      return tx.alumni.create({
        data: {
          ...(userId ? { userId } : {}),
          name,
          field: field || "",
          batch: batch || "",
          quote: quote || "",
          imageUrl: imageUrl || null,
          achievements: achievements || null,
          order: order ?? 0,
          showOnSite: showOnSite ?? true,
        },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      });
    });

    return NextResponse.json({ alumni }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    if (error instanceof Error && error.message === "ALREADY_LINKED") return NextResponse.json({ error: "این کاربر قبلاً به عنوان هنرآموخته ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در ایجاد هنرآموخته" }, { status: 500 });
  }
}
