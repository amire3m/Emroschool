import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { findActiveDiscountCode } from "@/lib/discount-codes";
import {
  applyDiscountToAmount,
  resolveDiscountFields,
} from "@/lib/course-application-discount";

interface ApplicationForDiscount {
  id: string;
  status: string;
  userId: string;
  courseId: string;
  course: { price: number };
  paymentOrder: { status: string } | null;
}

const defaultDependencies = {
  db: prisma,
  findDiscount: findActiveDiscountCode,
  applyDiscountToAmount,
  resolveDiscountFields,
  verify: verifyToken,
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
  overrides: Partial<typeof defaultDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const authorization = req.headers.get("authorization");
  const user = authorization?.startsWith("Bearer ") ? dependencies.verify(authorization.slice(7)) : null;
  if (!user) return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید" }, { status: 401 });

  try {
    const body = await req.json();
    if (typeof body.discountCode !== "string") {
      return NextResponse.json({ error: "کد تخفیف نامعتبر است" }, { status: 400 });
    }
    const discountCode = body.discountCode.trim();

    const application = (await dependencies.db.courseApplication.findUnique({
      where: { id: params.id },
      include: { course: { select: { price: true } }, paymentOrder: { select: { status: true } } },
    })) as ApplicationForDiscount | null;

    if (!application || application.userId !== user.id) {
      return NextResponse.json({ error: "درخواست ثبت‌نام پیدا نشد" }, { status: 404 });
    }
    if (!["pending", "pending_payment"].includes(application.status)) {
      return NextResponse.json(
        { error: "این درخواست دیگر قابل ویرایش نیست" },
        { status: 400 },
      );
    }
    if (application.paymentOrder && application.paymentOrder.status === "paid") {
      return NextResponse.json(
        { error: "این درخواست قبلاً پرداخت شده است" },
        { status: 400 },
      );
    }

    let discount: Awaited<ReturnType<typeof dependencies.findDiscount>> = null;
    if (discountCode) {
      discount = await dependencies.findDiscount(discountCode, true);
      if (!discount) {
        return NextResponse.json({ error: "کد تخفیف نامعتبر است" }, { status: 400 });
      }
    }

    const fields = dependencies.resolveDiscountFields(discount);
    const finalAmountTomans = dependencies.applyDiscountToAmount(
      application.course.price,
      fields.discountPercent,
    );

    const updated = await dependencies.db.courseApplication.update({
      where: { id: application.id },
      data: { ...fields, finalAmountTomans },
    });

    return NextResponse.json({ application: updated, finalAmountTomans });
  } catch (error) {
    console.error("Course application discount PATCH error:", error);
    return NextResponse.json({ error: "خطا در اعمال تخفیف" }, { status: 500 });
  }
}
