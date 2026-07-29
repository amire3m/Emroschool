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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const existing = await prisma.alumni.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "هنرآموخته پیدا نشد" }, { status: 404 });
    }

    const body = await req.json();
    const { name, field, batch, quote, imageUrl, achievements, order, showOnSite } = body;

    const alumni = await prisma.alumni.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(field !== undefined && { field }),
        ...(batch !== undefined && { batch }),
        ...(quote !== undefined && { quote }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(achievements !== undefined && { achievements }),
        ...(order !== undefined && { order }),
        ...(showOnSite !== undefined && { showOnSite }),
      },
    });

    return NextResponse.json({ alumni });
  } catch {
    return NextResponse.json({ error: "خطا در بروزرسانی هنرآموخته" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const existing = await prisma.alumni.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "هنرآموخته پیدا نشد" }, { status: 404 });
    }

    await prisma.alumni.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "هنرآموخته با موفقیت حذف شد" });
  } catch {
    return NextResponse.json({ error: "خطا در حذف هنرآموخته" }, { status: 500 });
  }
}
