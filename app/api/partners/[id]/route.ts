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
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const existing = await prisma.partner.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "همراه پیدا نشد" }, { status: 404 });

    const body = await req.json();
    const { name, logoUrl, order, showOnSite } = body;

    const partner = await prisma.partner.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(order !== undefined && { order }),
        ...(showOnSite !== undefined && { showOnSite }),
      },
    });
    return NextResponse.json({ partner });
  } catch {
    return NextResponse.json({ error: "خطا در بروزرسانی" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    await prisma.partner.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "همراه حذف شد" });
  } catch {
    return NextResponse.json({ error: "خطا در حذف" }, { status: 500 });
  }
}
