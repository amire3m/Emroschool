import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendProfileRejectionNotification } from "@/lib/profile-review-notification";

async function reviewer(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !["admin", "superadmin"].includes(user.role)) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try {
    const permissions = JSON.parse(user.permissions);
    return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("users") || permissions.includes("support")) ? user : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await reviewer(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const { status, rejectionReason } = await req.json();
    if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "وضعیت بررسی نامعتبر است" }, { status: 400 });
    const reason = typeof rejectionReason === "string" ? rejectionReason.trim() : "";
    if (status === "rejected" && (!reason || reason.length > 1000)) return NextResponse.json({ error: "دلیل رد پروفایل الزامی است و حداکثر ۱۰۰۰ کاراکتر دارد" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, name: true, email: true, notificationEmailEnabled: true } });
    if (!user) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { profileApprovalStatus: status, profileVisible: status === "approved", profileReviewedAt: new Date(), profileReviewerId: admin.id, profileRejectionReason: status === "rejected" ? reason : null },
      select: { id: true, profileApprovalStatus: true, profileVisible: true, profileReviewedAt: true, profileReviewerId: true },
    });
    if (status === "rejected") await sendProfileRejectionNotification(user, reason);
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "بررسی پروفایل انجام نشد" }, { status: 500 });
  }
}
