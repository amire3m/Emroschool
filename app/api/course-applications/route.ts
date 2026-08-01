import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole, verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { isValidIranianNationalCode, normalizeIranianNationalCode } from "@/lib/iranian-national-code";
import { isValidIranianMobile, normalizeIranianMobile } from "@/lib/iranian-mobile";
import { ensureDiscountCodes, findActiveDiscountCode } from "@/lib/discount-codes";

function tokenUser(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
}

export async function GET(req: NextRequest) {
  const user = tokenUser(req);
  if (!user) return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید" }, { status: 401 });
  try {
    const adminView = new URL(req.url).searchParams.get("admin") === "1";
    if (adminView) {
      if (!isAdminRole(user.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
      const admin = await getUserFromToken(req.headers.get("authorization")!.slice(7));
      if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
      if (admin.role !== "superadmin" && admin.permissions) { try { const permissions = JSON.parse(admin.permissions); if (permissions.length > 0 && !permissions.includes("applications")) return NextResponse.json({ error: "دسترسی مدیریت ثبت‌نام را ندارید" }, { status: 403 }); } catch { return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); } }
    }
    const applications = await prisma.courseApplication.findMany({
      where: adminView ? undefined : { userId: user.id },
      include: {
        course: { select: { id: true, title: true, slug: true, thumbnail: true, startDate: true } },
        ...(adminView ? { user: { select: { id: true, name: true, email: true, phone: true } } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Course applications GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت درخواست‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = tokenUser(req);
  if (!token) return NextResponse.json({ error: "برای ثبت‌نام ابتدا وارد حساب کاربری شوید" }, { status: 401 });
  try {
    const body = await req.json();
    if (typeof body.courseId !== "string" || !body.courseId) return NextResponse.json({ error: "شناسه دوره الزامی است" }, { status: 400 });
    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (!course || !course.published) return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    if (course.scheduleStatus !== "upcoming") return NextResponse.json({ error: "این دوره در حال حاضر پذیرش فرم ثبت‌نام ندارد" }, { status: 400 });
    const existingApplication = await prisma.courseApplication.findUnique({ where: { userId_courseId: { userId: token.id, courseId: body.courseId } } });
    if (existingApplication) {
      if (existingApplication.status === "pending_payment") return NextResponse.json({ application: existingApplication, profileUpdated: false, finalAmountTomans: existingApplication.finalAmountTomans });
      return NextResponse.json({ error: "قبلاً برای این دوره درخواست ثبت‌نام ارسال کرده‌اید" }, { status: 409 });
    }
     const requiredFields = ["courseId", "fullName", "email", "phone", "nationalCode", "birthDate", "province", "city", "address", "educationLevel", "educationField", "reason", "workHistory", "artHistory", "instagramId", "virtualPhone"];
    if (requiredFields.some((field) => typeof body[field] !== "string" || !body[field].trim())) return NextResponse.json({ error: "لطفاً تمام فیلدهای الزامی فرم را تکمیل کنید" }, { status: 400 });
     if (body.knowsInstructors === true && !body.familiarityDetails?.trim()) return NextResponse.json({ error: "محل آشنایی قبلی با اساتید را وارد کنید" }, { status: 400 });
    const nationalCode = normalizeIranianNationalCode(body.nationalCode);
    if (!isValidIranianNationalCode(nationalCode)) return NextResponse.json({ error: "کد ملی واردشده معتبر نیست" }, { status: 400 });
    const normalizedPhone = normalizeIranianMobile(body.phone);
    if (!isValidIranianMobile(normalizedPhone)) return NextResponse.json({ error: "شماره تلفن همراه واردشده معتبر نیست" }, { status: 400 });
    await ensureDiscountCodes();
    const discount = typeof body.discountGroup === "string" && body.discountGroup.trim()
      ? await findActiveDiscountCode(body.discountGroup)
      : null;
    if (typeof body.discountGroup === "string" && body.discountGroup.trim() && !discount) return NextResponse.json({ error: "گروه تخفیف معتبر نیست" }, { status: 400 });
    const existingUser = await prisma.user.findUnique({ where: { id: token.id } });
    if (!existingUser) return NextResponse.json({ error: "حساب کاربری پیدا نشد" }, { status: 404 });
    const email = body.email.trim().toLowerCase();
    const fullName = body.fullName.trim();
    const phone = normalizedPhone;
    const profileUpdated = existingUser.name !== fullName || existingUser.email !== email || existingUser.phone !== phone || existingUser.nationalCode !== nationalCode;

    const application = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: token.id }, data: {
         name: fullName, email, phone, birthDate: body.birthDate.trim(), province: body.province.trim(), city: body.city.trim(), address: body.address.trim(), postalCode: body.postalCode?.trim() || null,
        workHistory: body.workHistory?.trim() || null, artHistory: body.artHistory?.trim() || null,
        educationLevel: body.educationLevel.trim(), educationField: body.educationField.trim(), instagramId: body.instagramId?.trim() || null,
        virtualPhone: body.virtualPhone.trim(), landline: body.landline?.trim() || null, nationalCode,
      } });
      return tx.courseApplication.create({ data: {
        userId: token.id, courseId: body.courseId, fullName, email, phone, nationalCode,
         birthDate: body.birthDate.trim(),
         province: body.province.trim(), city: body.city.trim(), address: body.address.trim(), postalCode: body.postalCode?.trim() || "",
        workHistory: body.workHistory?.trim() || null, artHistory: body.artHistory?.trim() || null,
        educationLevel: body.educationLevel.trim(), educationField: body.educationField.trim(), reason: body.reason.trim(),
        knowsInstructors: Boolean(body.knowsInstructors), familiarityDetails: body.knowsInstructors ? body.familiarityDetails.trim() : null,
         instagramId: body.instagramId.trim(), virtualPhone: body.virtualPhone.trim(), landline: body.landline?.trim() || null,
        discountCode: discount?.code || null, discountLabel: discount?.label || null, discountPercent: discount?.percent || 0,
        finalAmountTomans: Math.round(course.price * (100 - (discount?.percent || 0)) / 100),
      } });
    });
    return NextResponse.json({ application, profileUpdated, finalAmountTomans: application.finalAmountTomans }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const target = String((error as { meta?: { target?: unknown } }).meta?.target || "");
       return NextResponse.json({ error: target.includes("email") ? "این ایمیل متعلق به حساب دیگری است" : target.includes("nationalCode") ? "این کد ملی پیش‌تر برای حساب دیگری ثبت شده است" : "قبلاً برای این دوره درخواست ثبت‌نام ارسال کرده‌اید" }, { status: 409 });
    }
    console.error("Course application POST error:", error);
    return NextResponse.json({ error: "خطا در ارسال فرم ثبت‌نام" }, { status: 500 });
  }
}
