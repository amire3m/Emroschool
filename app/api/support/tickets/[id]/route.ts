import prisma from "@/lib/prisma";
import { createSupportNotification, getAuthenticatedUser } from "@/lib/support";
import { NextRequest, NextResponse } from "next/server";
import { queueSupportUserMessageEvent } from "@/lib/bale-group-notifications";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  const ticket = await prisma.supportTicket.findFirst({ where: { id: params.id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } } } });
  if (!ticket) return NextResponse.json({ error: "تیکت پیدا نشد" }, { status: 404 });
  return NextResponse.json({ ticket });
}

const defaultDependencies = { db: prisma, authenticate: getAuthenticatedUser };

export async function POST(req: NextRequest, { params }: { params: { id: string } }, overrides: Partial<typeof defaultDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const user = await dependencies.authenticate(req);
  if (!user) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { message } = await req.json();
    const body = typeof message === "string" ? message.trim() : "";
    if (!body || body.length > 5000) return NextResponse.json({ error: "متن پیام الزامی است" }, { status: 400 });
    const ticket = await dependencies.db.supportTicket.findFirst({ where: { id: params.id, userId: user.id } });
    if (!ticket) return NextResponse.json({ error: "تیکت پیدا نشد" }, { status: 404 });
    if (ticket.status === "closed") return NextResponse.json({ error: "تیکت بسته شده است" }, { status: 400 });
    const updated = await dependencies.db.$transaction(async (tx) => {
      const changed = await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "waiting_for_support" } });
      const message = await tx.supportMessage.create({
        data: { body, authorId: user.id, ticketId: ticket.id },
        include: { author: { select: { name: true, role: true } }, ticket: { select: { subject: true, userId: true } } },
      });
      await queueSupportUserMessageEvent(tx, message, message.createdAt);
      return changed;
    });
    return NextResponse.json({ ticket: updated });
  } catch { return NextResponse.json({ error: "ارسال پیام ناموفق بود" }, { status: 500 }); }
}
