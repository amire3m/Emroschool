import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { decryptPaymentCard } from "@/lib/payment-card-crypto";

async function admin(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !isAdminRole(user.role)) return null;
  if (user.role !== "superadmin" && user.permissions) {
    try { const permissions = JSON.parse(user.permissions); if (permissions.length && !permissions.includes("payments") && !permissions.includes("support")) return null; } catch { return null; }
  }
  return user;
}

const defaultDependencies = { db: prisma, authorize: admin };

export async function GET(
  req: NextRequest,
  _context: unknown = {},
  overrides: Partial<typeof defaultDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (!await dependencies.authorize(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const [orders, settings] = await Promise.all([
    dependencies.db.paymentOrder.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, emailVerified: true, role: true, userType: true, phone: true, balePhone: true, nationalCode: true, phoneVerified: true, createdAt: true, updatedAt: true } },
        course: true,
        application: { select: { id: true, status: true, userId: true, courseId: true, fullName: true, email: true, phone: true, nationalCode: true, birthDate: true, province: true, city: true, address: true, postalCode: true, workHistory: true, artHistory: true, educationLevel: true, educationField: true, reason: true, knowsInstructors: true, familiarityDetails: true, instagramId: true, virtualPhone: true, landline: true, discountCode: true, discountLabel: true, discountPercent: true, finalAmountTomans: true, discountDocumentUrl: true, createdAt: true, updatedAt: true } },
        reviewer: { select: { id: true, name: true, email: true, role: true, userType: true, createdAt: true, updatedAt: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        attempts: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            method: true,
            status: true,
            amountRials: true,
            balePaymentId: true,
            baleTrackingNumber: true,
            baleReceiptReference: true,
            baleVerificationStatus: true,
            rejectionReason: true,
            createdAt: true,
            expiresAt: true,
            baleInvoiceSentAt: true,
            balePreCheckoutAt: true,
            paidAt: true,
            submittedAt: true,
            invalidatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    dependencies.db.paymentSettings.findUnique({ where: { id: 1 } }),
  ]);
  const safeOrders = orders.map(({ payerCardEncrypted, balePayload: _balePayload, ...order }) => ({
    ...order,
    attempts: order.attempts.map(({ balePayload: _attemptPayload, ...attempt }: any) => attempt),
    payerCardNumber: payerCardEncrypted ? (() => { try { return decryptPaymentCard(payerCardEncrypted); } catch { return null; } })() : null,
  }));
  return NextResponse.json({ orders: safeOrders, settings });
}

export async function PATCH(req: NextRequest) {
  if (!await admin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const body = await req.json();
    const settings = await prisma.paymentSettings.upsert({ where: { id: 1 }, create: { id: 1, cardNumber: typeof body.cardNumber === "string" ? body.cardNumber.trim() || null : null, cardHolder: typeof body.cardHolder === "string" ? body.cardHolder.trim() || null : null, cardInstructions: typeof body.cardInstructions === "string" ? body.cardInstructions.trim() || null : null, adminChatId: typeof body.adminChatId === "string" ? body.adminChatId.trim() || null : null }, update: { cardNumber: typeof body.cardNumber === "string" ? body.cardNumber.trim() || null : undefined, cardHolder: typeof body.cardHolder === "string" ? body.cardHolder.trim() || null : undefined, cardInstructions: typeof body.cardInstructions === "string" ? body.cardInstructions.trim() || null : undefined, adminChatId: typeof body.adminChatId === "string" ? body.adminChatId.trim() || null : undefined } });
    return NextResponse.json({ settings });
  } catch { return NextResponse.json({ error: "ذخیره تنظیمات انجام نشد" }, { status: 500 }); }
}
