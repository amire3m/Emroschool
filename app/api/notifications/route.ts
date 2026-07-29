import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

function getTokenUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest) {
  try {
    const tokenUser = getTokenUser(req);

    if (!tokenUser) {
      return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
    }

    if (tokenUser.role === "admin") {
      const notifications = await prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { users: true } },
        },
      });

      const result = notifications.map((n) => ({
        ...n,
        recipientCount: n._count.users,
        _count: undefined,
      }));

      return NextResponse.json({ notifications: result });
    }

    const userNotifications = await prisma.userNotification.findMany({
      where: { userId: tokenUser.id },
      orderBy: { createdAt: "desc" },
      include: {
        notification: true,
      },
    });

    const result = userNotifications.map((un) => ({
      id: un.notification.id,
      title: un.notification.title,
      message: un.notification.message,
      type: un.notification.type,
      channel: un.notification.channel,
      courseId: un.notification.courseId,
      createdAt: un.notification.createdAt,
      read: un.read,
      readAt: un.readAt,
      userNotificationId: un.id,
    }));

    return NextResponse.json({ notifications: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت اعلان‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const tokenUser = getTokenUser(req);
  if (!tokenUser || tokenUser.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, message, type, channel, sendToAll, courseId } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "عنوان و پیام الزامی است" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type ?? "in-app",
        channel: channel ?? null,
        sendToAll: sendToAll ?? false,
        courseId: courseId ?? null,
      },
    });

    if (sendToAll) {
      const users = await prisma.user.findMany({ select: { id: true } });
      await prisma.userNotification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          notificationId: notification.id,
        })),
      });
    }

    const created = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(
      {
        notification: {
          ...created,
          recipientCount: created?._count.users ?? 0,
          _count: undefined,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "خطا در ایجاد اعلان" }, { status: 500 });
  }
}
