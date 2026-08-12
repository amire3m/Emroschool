import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole, verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { enrollmentGrantSources, ensureEnrollmentGrant } from "@/lib/payment-review";

const defaultDependencies = {
  db: prisma,
  authorize: async (authorization: string) => getUserFromToken(authorization.slice(7)),
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authorization = req.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید" }, { status: 401 });
  try {
    const application = await prisma.courseApplication.findFirst({
      where: { id: params.id, userId: user.id },
      include: { course: true },
    });
    if (!application) return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    return NextResponse.json({ application });
  } catch (error) {
    console.error("Course application GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت درخواست" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }, overrides: Partial<typeof defaultDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const authorization = req.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!user || !isAdminRole(user.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const admin = await dependencies.authorize(authorization!);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  if (admin.role !== "superadmin" && admin.permissions) { try { const permissions = JSON.parse(admin.permissions); if (permissions.length > 0 && !permissions.includes("applications")) return NextResponse.json({ error: "دسترسی مدیریت ثبت‌نام را ندارید" }, { status: 403 }); } catch { return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); } }
  try {
    const { status } = await req.json();
    if (!["pending_payment", "pending", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    const existing = await dependencies.db.courseApplication.findUnique({ where: { id: params.id }, include: { paymentOrder: { select: { id: true, method: true, status: true } } } });
    if (!existing) return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
    if (existing.paymentOrder?.method === "card_to_card" && existing.paymentOrder.status === "paid") {
      if (status !== existing.status) return NextResponse.json({ error: "اصلاح این درخواست باید از بررسی پرداخت انجام شود" }, { status: 409 });
      return NextResponse.json({ application: existing });
    }
    const application = await dependencies.db.$transaction(async (tx) => {
      const updated = await tx.courseApplication.update({ where: { id: params.id }, data: { status } });
      if (status === "approved") await ensureEnrollmentGrant(tx, { userId: existing.userId, courseId: existing.courseId, sourceType: enrollmentGrantSources.applicationApproval, sourceId: existing.id });
      return updated;
    });
    return NextResponse.json({ application });
  } catch (error) {
    console.error("Course application PATCH error:", error);
    return NextResponse.json({ error: "خطا در بروزرسانی درخواست" }, { status: 500 });
  }
}
