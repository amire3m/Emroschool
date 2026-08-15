import prisma from "./prisma";
import { sendPushToUsers } from "./push";

export interface PushNotificationContent {
  title: string;
  body: string;
  url: string;
}

type SendPush = typeof sendPushToUsers;

export function buildAdminApplicationPush(application: { fullName?: string | null; course?: { title?: string | null } | null }): PushNotificationContent {
  return {
    title: "درخواست ثبت‌نام جدید",
    body: `«${application.course?.title || ""}» — ${application.fullName || ""}`,
    url: "/admin/applications",
  };
}

export function buildAdminPaymentPush(order: { orderNumber: string }, application: { fullName?: string | null; course?: { title?: string | null } | null }): PushNotificationContent {
  return {
    title: "سفارش پرداخت جدید",
    body: `«${application.course?.title || ""}» — ${application.fullName || ""} — ${order.orderNumber}`,
    url: "/admin/payments",
  };
}

export function buildReleasePush(release: { version?: string | null; title: string }): PushNotificationContent {
  return {
    title: release.title,
    body: `نسخه ${release.version || ""} منتشر شد`,
    url: "/",
  };
}

export async function notifyAdminsPush(
  content: PushNotificationContent,
  deps: {
    findAdmins?: () => Promise<Array<{ id: string }>>;
    send?: SendPush;
  } = {},
) {
  const findAdmins =
    deps.findAdmins ||
    (async () =>
      prisma.user.findMany({
        where: { role: { in: ["admin", "superadmin"] } },
        select: { id: true },
      }));
  const send = deps.send || sendPushToUsers;
  const admins = await findAdmins();
  if (admins.length === 0) return { total: 0, sent: 0, expired: 0, failed: 0 };
  return send({
    userIds: admins.map((admin) => admin.id),
    title: content.title,
    body: content.body,
    url: content.url,
  });
}

export async function notifyAllSubscribedUsersPush(
  content: PushNotificationContent,
  deps: {
    findSubscribedUserIds?: () => Promise<string[]>;
    send?: SendPush;
  } = {},
) {
  const findSubscribedUserIds =
    deps.findSubscribedUserIds ||
    (async () => {
      const rows = await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ["userId"] });
      return rows.map((row) => row.userId);
    });
  const send = deps.send || sendPushToUsers;
  const userIds = await findSubscribedUserIds();
  if (userIds.length === 0) return { total: 0, sent: 0, expired: 0, failed: 0 };
  return send({
    userIds,
    title: content.title,
    body: content.body,
    url: content.url,
  });
}
