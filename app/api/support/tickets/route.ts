import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/support";
import { NextRequest, NextResponse } from "next/server";
import { queueSupportTicketEvent } from "@/lib/bale-group-notifications";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { subject, message } = await req.json();
    const cleanSubject = typeof subject === "string" ? subject.trim() : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    if (!cleanSubject || cleanSubject.length > 150 || !cleanMessage || cleanMessage.length > 5000) return NextResponse.json({ error: "عنوان و متن تیکت الزامی است" }, { status: 400 });
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: { subject: cleanSubject, status: "waiting_for_support", userId: user.id },
        include: { user: { select: { name: true } } },
      });
      await tx.supportMessage.create({ data: { ticketId: created.id, body: cleanMessage, authorId: user.id } });
      await queueSupportTicketEvent(tx, created, created.createdAt);
      return tx.supportTicket.findUniqueOrThrow({ where: { id: created.id }, include: { messages: { include: { author: { select: { id: true, name: true, role: true } } } } } });
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "ایجاد تیکت ناموفق بود" }, { status: 500 });
  }
}
