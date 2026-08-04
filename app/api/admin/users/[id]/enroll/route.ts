import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

async function getUsersAdmin(req: NextRequest) {
  const header = req.headers.get("authorization");
  const admin = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!admin || !["admin", "superadmin"].includes(admin.role)) return null;
  if (admin.role === "superadmin" || !admin.permissions) return admin;
  try { const permissions = JSON.parse(admin.permissions); return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("users")) ? admin : null; } catch { return null; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getUsersAdmin(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const { courseId } = await req.json();
    if (typeof courseId !== "string" || !courseId) return NextResponse.json({ error: "دوره را انتخاب کنید" }, { status: 400 });
    const [user, course] = await Promise.all([prisma.user.findUnique({ where: { id: params.id }, select: { id: true } }), prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } })]);
    if (!user) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    if (!course) return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.create({ data: { userId: user.id, courseId: course.id }, include: { course: { select: { id: true, title: true } } } });
      await tx.userAuditLog.create({ data: { actorId: admin.id, targetUserId: user.id, action: "manual_enrollment", fields: JSON.stringify([course.id]) } });
      return created;
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "کاربر پیش‌تر در این دوره ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "افزودن دوره ناموفق بود" }, { status: 500 });
  }
}
