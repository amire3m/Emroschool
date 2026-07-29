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
