import crypto from "crypto";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function paymentAdmin(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !["admin", "superadmin"].includes(user.role)) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try {
    const permissions = JSON.parse(user.permissions);
    return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("payments") || permissions.includes("support")) ? user : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const admin = await paymentAdmin(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const { applicationId, reference, note } = await req.json();
    if (typeof applicationId !== "string" || !applicationId) return NextResponse.json({ error: "شناسه درخواست الزامی است" }, { status: 400 });
    if (reference !== undefined && typeof reference !== "string") return NextResponse.json({ error: "شماره پیگیری نامعتبر است" }, { status: 400 });
    if (note !== undefined && typeof note !== "string") return NextResponse.json({ error: "یادداشت نامعتبر است" }, { status: 400 });

    const order = await prisma.$transaction(async (tx) => {
      const application = await tx.courseApplication.findUnique({ where: { id: applicationId }, select: { id: true, status: true, userId: true, courseId: true, finalAmountTomans: true, paymentOrder: { select: { id: true } } } });
      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== "pending_payment" || application.paymentOrder) throw new Error("DUPLICATE");
      const now = new Date();
      const created = await tx.paymentOrder.create({
        data: {
          orderNumber: `MAN-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          amountTomans: application.finalAmountTomans,
          amountRials: application.finalAmountTomans * 10,
          method: "manual",
          status: "paid",
          manualReference: reference?.trim() || null,
          manualNote: note?.trim() || null,
          createdById: admin.id,
          reviewedAt: now,
          paidAt: now,
          userId: application.userId,
          courseId: application.courseId,
          applicationId: application.id,
        },
      });
      await tx.courseApplication.update({ where: { id: application.id }, data: { status: "approved" } });
      await tx.enrollment.upsert({ where: { userId_courseId: { userId: application.userId, courseId: application.courseId } }, update: {}, create: { userId: application.userId, courseId: application.courseId } });
      return created;
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });
    if (error instanceof Error && error.message === "DUPLICATE") return NextResponse.json({ error: "این درخواست قبلا پرداخت یا بررسی شده است" }, { status: 409 });
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این درخواست قبلا پرداخت یا بررسی شده است" }, { status: 409 });
    console.error("Manual payment error:", error);
    return NextResponse.json({ error: "ثبت پرداخت دستی انجام نشد" }, { status: 500 });
  }
}
