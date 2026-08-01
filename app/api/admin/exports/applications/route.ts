import prisma from "@/lib/prisma";
import { canExport } from "../_auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (!await canExport(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const records = await prisma.courseApplication.findMany({
    include: {
      course: true,
      user: { select: { id: true, name: true, email: true, phone: true, balePhone: true, nationalCode: true, emailVerified: true, phoneVerified: true, createdAt: true, updatedAt: true } },
      paymentOrder: { select: { id: true, orderNumber: true, amountTomans: true, amountRials: true, method: true, status: true, receiptUrl: true, baleTransactionRef: true, baleInvoiceUrl: true, payerBaleId: true, payerBaleName: true, manualReference: true, manualNote: true, createdAt: true, updatedAt: true, receiptSubmittedAt: true, reviewedAt: true, paidAt: true, expiresAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ exportedAt: new Date().toISOString(), records });
}
