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
    const { courseId, method } = await req.json();
    if (!courseId || !["card_to_card", "bale_wallet"].includes(method)) return NextResponse.json({ error: "اطلاعات پرداخت نامعتبر است" }, { status: 400 });
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || !course.published || course.scheduleStatus === "completed" || course.registrationMode !== "purchase" || course.price <= 0) return NextResponse.json({ error: "این دوره قابل پرداخت نیست" }, { status: 400 });
    const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: id, courseId } } });
    const paid = await prisma.paymentOrder.findFirst({ where: { userId: id, courseId, status: "paid" } });
    const active = await prisma.paymentOrder.findFirst({ where: { userId: id, courseId, status: { in: ["pending", "awaiting_receipt", "under_review"] } } });
    if (enrolled || paid || active) return NextResponse.json({ error: "برای این دوره یک سفارش فعال یا ثبت‌نام دارید" }, { status: 409 });

    const orderNumber = `PAY-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const payload = method === "bale_wallet" ? `payment:${orderNumber}:${crypto.randomBytes(16).toString("hex")}` : null;
    const order = await prisma.paymentOrder.create({ data: { orderNumber, amountTomans: course.price, amountRials: course.price * 10, method, status: method === "card_to_card" ? "awaiting_receipt" : "pending", balePayload: payload, userId: id, courseId } });
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
  const orders = await prisma.paymentOrder.findMany({ where: { userId: id }, include: { course: { select: { id: true, title: true, slug: true, thumbnail: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ orders });
}
