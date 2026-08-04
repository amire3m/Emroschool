import prisma from "@/lib/prisma";
import { createSupportNotification, getAuthenticatedUser } from "@/lib/support";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  const ticket = await prisma.supportTicket.findFirst({ where: { id: params.id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } } } });
  if (!ticket) return NextResponse.json({ error: "تیکت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { message } = await req.json();
    const body = typeof message === "string" ? message.trim() : "";
    if (!body || body.length > 5000) return NextResponse.json({ error: "متن پیام الزامی است" }, { status: 400 });
    const ticket = await prisma.supportTicket.findFirst({ where: { id: params.id, userId: user.id } });
    if (!ticket) return NextResponse.json({ error: "تیکت پیدا نشد" }, { status: 404 });
    if (ticket.status === "closed") return NextResponse.json({ error: "تیکت بسته شده است" }, { status: 400 });
    const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "waiting_for_support", messages: { create: { body, authorId: user.id } } } });
    return NextResponse.json({ ticket: updated });
  } catch { return NextResponse.json({ error: "ارسال پیام ناموفق بود" }, { status: 500 }); }
}
