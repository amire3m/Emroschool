import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function userId(req: NextRequest) {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? verifyToken(header.slice(7))?.id : null;
}

export async function POST(req: NextRequest) {
  const id = userId(req);
  if (!id) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  try {
    const { applicationId, method } = await req.json();
    if (!applicationId) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const application = await prisma.courseApplication.findUnique({ where: { id: applicationId }, include: { course: true, paymentOrder: true } });
    if (!application || application.userId !== id) return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    if (!['pending', 'pending_payment'].includes(application.status) || !application.course.published || application.course.scheduleStatus !== "upcoming") return NextResponse.json({ error: "این درخواست قابل پرداخت نیست" }, { status: 400 });
    const discount = application.discountCode ? await prisma.discountCode.findUnique({ where: { code: application.discountCode } }) : null;
    if (discount?.requiresDocument && !application.discountDocumentUrl) return NextResponse.json({ error: "بارگذاری مدرک تخفیف الزامی است" }, { status: 400 });
    if (application.paymentOrder) return NextResponse.json({ error: "برای این درخواست یک سفارش ثبت شده است" }, { status: 409 });
    const course = application.course;
    if (application.finalAmountTomans === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.courseApplication.update({ where: { id: application.id }, data: { status: "approved" } });
        await tx.enrollment.upsert({ where: { userId_courseId: { userId: id, courseId: course.id } }, update: {}, create: { userId: id, courseId: course.id } });
      });
      return NextResponse.json({ complete: true });
    }
    if (!["card_to_card", "bale_wallet"].includes(method)) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });

    const orderNumber = `PAY-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const payload = method === "bale_wallet" ? `payment:${orderNumber}:${crypto.randomBytes(16).toString("hex")}` : null;
    const order = await prisma.paymentOrder.create({ data: { orderNumber, amountTomans: application.finalAmountTomans, amountRials: application.finalAmountTomans * 10, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", balePayload: payload, userId: id, courseId: course.id, applicationId: application.id } });
    const settings = method === "card_to_card" ? await prisma.paymentSettings.findUnique({ where: { id: 1 } }) : null;
    const botUsername = process.env.BALE_BOT_USERNAME || "imamruhollahschool_bot";
    return NextResponse.json({ order, baleBotUrl: method === "bale_wallet" ? `https://ble.ir/${botUsername}?start=${encodeURIComponent(payload!)}` : undefined, paymentInstructions: settings ? { cardNumber: settings.cardNumber, cardHolder: settings.cardHolder, instructions: settings.cardInstructions } : undefined }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BALE_NOT_CONFIGURED") return NextResponse.json({ error: "پرداخت بله پیکربندی نشده است" }, { status: 503 });
    console.error("Payment creation error:", error);
    return NextResponse.json({ error: "ایجاد سفارش انجام نشد" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = userId(req);
  if (!id) return NextResponse.json({ error: "نیازمند احراز هویت" }, { status: 401 });
  const orders = await prisma.paymentOrder.findMany({ where: { userId: id }, include: { course: { select: { id: true, title: true, slug: true, thumbnail: true } }, application: { select: { id: true, status: true, finalAmountTomans: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ orders });
}
