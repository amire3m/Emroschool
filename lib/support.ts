import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { NextRequest } from "next/server";
import { emailShell, htmlEscape, sendSiteEmail } from "@/lib/email";

export async function getAuthenticatedUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? getUserFromToken(header.slice(7)) : null;
}

export function canManageSupport(user: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
  if (!user || !["admin", "superadmin"].includes(user.role)) return false;
  if (user.role === "superadmin" || !user.permissions) return true;
  try {
    const permissions = JSON.parse(user.permissions);
    return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("support"));
  } catch {
    return false;
  }
}

export async function createSupportNotification(userId: string, title: string, message: string) {
  const notification = await prisma.notification.create({
    data: { title, message, type: "support", channel: "in-app", sendToAll: false },
  });
  await prisma.userNotification.create({ data: { userId, notificationId: notification.id } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, notificationEmailEnabled: true } });
  if (user?.notificationEmailEnabled) {
    try {
      await sendSiteEmail({
        to: user.email,
        subject: title,
        text: message,
        html: emailShell(`<h1 style="margin:0 0 14px;color:#03004b;font-size:22px">${htmlEscape(title)}</h1><p style="margin:0;font-size:15px;line-height:2;color:#3c3b4d">${htmlEscape(message)}</p>`),
      });
    } catch {
      // Support workflow remains available when the optional email gateway is unavailable.
    }
  }
}
