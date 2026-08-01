import prisma from "@/lib/prisma";
import { answerPreCheckoutQuery, inquireTransaction, sendInvoice } from "@/lib/bale-payment";
import { NextRequest, NextResponse } from "next/server";

function validOrder(order: { method: string; status: string; balePayload: string | null; amountRials: number }, payload: unknown, amount: unknown) {
  return order.method === "bale_wallet" && order.status === "pending" && order.balePayload === payload && order.amountRials === amount;
}

export async function POST(req: NextRequest, { params }: { params: { secret: string } }) {
  if (!process.env.BALE_WEBHOOK_SECRET || params.secret !== process.env.BALE_WEBHOOK_SECRET) return new NextResponse(null, { status: 404 });
  try {
    const update = await req.json();
    const startText = update?.message?.text;
    if (typeof startText === "string" && startText.startsWith("/start ")) {
      const payload = startText.slice(7).trim();
      const chatId = String(update?.message?.chat?.id || "");
      const order = await prisma.paymentOrder.findUnique({ where: { balePayload: payload }, include: { course: true } });
      if (order && chatId && order.method === "bale_wallet" && order.status === "pending") {
        await prisma.paymentOrder.update({ where: { id: order.id }, data: { baleChatId: chatId } });
        await sendInvoice(chatId, { title: order.course.title, description: `پرداخت دوره ${order.course.title}`, payload, amountRials: order.amountRials });
      }
      return NextResponse.json({ ok: true });
    }
    const preCheckout = update?.pre_checkout_query;
    if (preCheckout) {
      const order = await prisma.paymentOrder.findUnique({ where: { balePayload: preCheckout.invoice_payload } });
      const valid = order && validOrder(order, preCheckout.invoice_payload, preCheckout.total_amount);
      await answerPreCheckoutQuery(preCheckout.id, Boolean(valid), valid ? undefined : "اطلاعات پرداخت معتبر نیست.");
      return NextResponse.json({ ok: true });
    }

    const payment = update?.message?.successful_payment;
    if (!payment) return NextResponse.json({ ok: true });
    const order = await prisma.paymentOrder.findUnique({ where: { balePayload: payment.invoice_payload } });
    if (!order || !validOrder(order, payment.invoice_payload, payment.total_amount)) return NextResponse.json({ ok: true });
    const reference = String(payment.provider_payment_charge_id || payment.telegram_payment_charge_id || "");
    if (!reference) return NextResponse.json({ ok: true });
    const inquiry = await inquireTransaction(reference);
    if (!inquiry.verified) return NextResponse.json({ ok: true });

    await prisma.$transaction(async (tx) => {
      const current = await tx.paymentOrder.findUnique({ where: { id: order.id } });
      if (!current || current.status === "paid" || !validOrder(current, payment.invoice_payload, payment.total_amount)) return;
      await tx.paymentOrder.update({ where: { id: current.id }, data: { status: "paid", paidAt: new Date(), baleTransactionRef: reference } });
      if (current.applicationId) await tx.courseApplication.update({ where: { id: current.applicationId }, data: { status: "approved" } });
      await tx.enrollment.upsert({ where: { userId_courseId: { userId: current.userId, courseId: current.courseId } }, update: {}, create: { userId: current.userId, courseId: current.courseId } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Bale webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
