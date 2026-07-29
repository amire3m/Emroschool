import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

function getTokenUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice(7));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tokenUser = getTokenUser(req);
  if (!tokenUser) {
    return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  }

  try {
    const userNotification = await prisma.userNotification.findFirst({
      where: {
        userId: tokenUser.id,
        notificationId: params.id,
      },
    });

    if (!userNotification) {
      return NextResponse.json({ error: "اعلان پیدا نشد" }, { status: 404 });
    }

    const updated = await prisma.userNotification.update({
      where: { id: userNotification.id },
      data: { read: true, readAt: new Date() },
    });

    return NextResponse.json({ userNotification: updated });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی اعلان" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tokenUser = getTokenUser(req);
  if (!tokenUser || tokenUser.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json({ error: "اعلان پیدا نشد" }, { status: 404 });
    }

    await prisma.notification.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "اعلان با موفقیت حذف شد" });
  } catch (error) {
    return NextResponse.json({ error: "خطا در حذف اعلان" }, { status: 500 });
  }
}
