import prisma from "@/lib/prisma";
import { canManageSupport, getAuthenticatedUser } from "@/lib/support";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedUser(req);
  if (!canManageSupport(admin)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ tickets });
}
