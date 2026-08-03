import prisma from "@/lib/prisma";
import { ensureDiscountCodes } from "@/lib/discount-codes";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await ensureDiscountCodes();
    const discountCodes = await prisma.discountCode.findMany({
      where: { active: true, label: { not: "" } },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return NextResponse.json({ discountCodes });
  } catch (error) {
    console.error("Discount codes GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت گروه‌های تخفیف" }, { status: 500 });
  }
}
