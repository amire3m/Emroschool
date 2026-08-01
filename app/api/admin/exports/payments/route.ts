import prisma from "@/lib/prisma";
import { canExport } from "../_auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (!await canExport(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const records = await prisma.paymentOrder.findMany({
    include: {
      course: true,
      user: { select: { id: true, name: true, email: true, phone: true, balePhone: true, nationalCode: true, emailVerified: true, phoneVerified: true, createdAt: true, updatedAt: true } },
      application: true,
      reviewer: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ exportedAt: new Date().toISOString(), records });
}
