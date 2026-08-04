import prisma from "@/lib/prisma";
import { canManageSupport, createSupportNotification, getAuthenticatedUser } from "@/lib/support";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAuthenticatedUser(req);
  if (!admin || !canManageSupport(admin)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id }, include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } } } });
  if (!ticket) return NextResponse.json({ error: "تیکت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAuthenticatedUser(req);
  if (!admin || !canManageSupport(admin)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const { message, status } = await req.json();
    const body = typeof message === "string" ? message.trim() : "";
    const allowedStatuses = ["open", "waiting_for_user", "waiting_for_support", "closed"];
    if (status !== undefined && !allowedStatuses.includes(status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    if (message !== undefined && (!body || body.length > 5000)) return NextResponse.json({ error: "متن پاسخ نامعتبر است" }, { status: 400 });
    if (!body && status === undefined) return NextResponse.json({ error: "تغییری ارسال نشده است" }, { status: 400 });
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (!ticket) return NextResponse.json({ error: "تیکت پیدا نشد" }, { status: 404 });
    const nextStatus = status ?? (body ? "waiting_for_user" : ticket.status);
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus, closedAt: nextStatus === "closed" ? new Date() : null, ...(body ? { messages: { create: { body, authorId: admin.id } } } : {}) },
    });
    if (body) await createSupportNotification(ticket.userId, `پاسخ به تیکت #${ticket.number}`, "پشتیبانی به تیکت شما پاسخ داده است.");
    return NextResponse.json({ ticket: updated });
  } catch { return NextResponse.json({ error: "بروزرسانی تیکت ناموفق بود" }, { status: 500 }); }
}
