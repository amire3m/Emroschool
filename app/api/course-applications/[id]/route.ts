import prisma from "@/lib/prisma";
import { isAdminRole, verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authorization = req.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!user || !isAdminRole(user.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const { status } = await req.json();
    if (!["pending", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    const existing = await prisma.courseApplication.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
    const application = await prisma.$transaction(async (tx) => {
      const updated = await tx.courseApplication.update({ where: { id: params.id }, data: { status } });
      if (status === "approved") await tx.enrollment.upsert({ where: { userId_courseId: { userId: existing.userId, courseId: existing.courseId } }, update: {}, create: { userId: existing.userId, courseId: existing.courseId } });
      return updated;
    });
    return NextResponse.json({ application });
  } catch (error) {
    console.error("Course application PATCH error:", error);
    return NextResponse.json({ error: "خطا در بروزرسانی درخواست" }, { status: 500 });
  }
}
