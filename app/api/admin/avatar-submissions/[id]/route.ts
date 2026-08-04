import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendAvatarRejectionNotification } from "@/lib/profile-review-notification";
import { NextRequest, NextResponse } from "next/server";

async function reviewer(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !["admin", "superadmin"].includes(user.role)) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try { const permissions = JSON.parse(user.permissions); return Array.isArray(permissions) && (!permissions.length || permissions.includes("users") || permissions.includes("support")) ? user : null; } catch { return null; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await reviewer(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const { status, rejectionReason } = await req.json();
    if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "وضعیت بررسی نامعتبر است" }, { status: 400 });
    const reason = typeof rejectionReason === "string" ? rejectionReason.trim() : "";
    if (status === "rejected" && (!reason || reason.length > 1000)) return NextResponse.json({ error: "دلیل رد تصویر الزامی است و حداکثر ۱۰۰۰ کاراکتر دارد" }, { status: 400 });
    const submission = await prisma.avatarSubmission.findUnique({ where: { id: params.id }, include: { user: { select: { id: true, name: true, email: true, notificationEmailEnabled: true } } } });
    if (!submission || submission.status !== "pending") return NextResponse.json({ error: "تصویر در انتظار بررسی پیدا نشد" }, { status: 404 });
    const result = await prisma.$transaction(async (tx) => {
      if (status === "approved") {
        await tx.avatarSubmission.updateMany({ where: { userId: submission.userId, status: "approved" }, data: { status: "superseded" } });
        await tx.user.update({ where: { id: submission.userId }, data: { avatar: submission.imageUrl } });
      }
      return tx.avatarSubmission.update({ where: { id: submission.id }, data: { status, rejectionReason: status === "rejected" ? reason : null, reviewedAt: new Date(), reviewerId: admin.id } });
    });
    if (status === "rejected") await sendAvatarRejectionNotification(submission.user, reason);
    return NextResponse.json({ submission: result });
  } catch { return NextResponse.json({ error: "بررسی تصویر انجام نشد" }, { status: 500 }); }
}
