import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

async function admin(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !isAdminRole(user.role)) return null;
  if (user.role !== "superadmin" && user.permissions) {
    try { const permissions = JSON.parse(user.permissions); if (permissions.length && !permissions.includes("payments")) return null; } catch { return null; }
  }
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewer = await admin(req);
  if (!reviewer) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const { action } = await req.json();
    if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({ where: { id: params.id } });
      if (!order) return null;
      if (order.method !== "card_to_card" || order.status !== "under_review") throw new Error("INVALID_STATUS");
      const updated = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: action === "approve" ? "paid" : "rejected", reviewerId: reviewer.id, reviewedAt: new Date(), ...(action === "approve" ? { paidAt: new Date() } : {}) } });
      if (action === "approve") await tx.enrollment.upsert({ where: { userId_courseId: { userId: order.userId, courseId: order.courseId } }, update: {}, create: { userId: order.userId, courseId: order.courseId } });
      return updated;
    });
    if (!result) return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    return NextResponse.json({ order: result });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATUS") return NextResponse.json({ error: "این سفارش قابل بررسی نیست" }, { status: 409 });
    console.error("Payment review error:", error);
    return NextResponse.json({ error: "بررسی پرداخت انجام نشد" }, { status: 500 });
  }
}
