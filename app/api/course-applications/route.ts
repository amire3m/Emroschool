import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole, verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { isValidIranianNationalCode, normalizeIranianNationalCode } from "@/lib/iranian-national-code";
import { isValidIranianMobile, normalizeIranianMobile } from "@/lib/iranian-mobile";
import { ensureDiscountCodes, findActiveDiscountCode } from "@/lib/discount-codes";
import { mergeRegistrationForm, parseRegistrationForm } from "@/lib/registration-form";
import { sendInitialCourseRegistrationNotification } from "@/lib/registration-notification";
import { queueCourseApplicationEvent } from "@/lib/bale-group-notifications";
import { notifyAdminsPush, buildAdminApplicationPush } from "@/lib/push-notifications";

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
        ...(adminView ? { user: { select: { id: true, name: true, email: true, phone: true, avatar: true } } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Course applications GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت درخواست‌ها" }, { status: 500 });
  }
}

const defaultPostDependencies = {
  db: prisma,
  ensureDiscounts: ensureDiscountCodes,
  findDiscount: findActiveDiscountCode,
  notify: sendInitialCourseRegistrationNotification,
  notifyAdminsPush,
};

export async function POST(req: NextRequest, _context: { params?: Record<string, string> } = {}, overrides: Partial<typeof defaultPostDependencies> = {}) {
  const dependencies = { ...defaultPostDependencies, ...overrides };
  const token = tokenUser(req);
  if (!token) return NextResponse.json({ error: "برای ثبت‌نام ابتدا وارد حساب کاربری شوید" }, { status: 401 });
  try {
    const body = await req.json();
    if (typeof body.courseId !== "string" || !body.courseId) return NextResponse.json({ error: "شناسه دوره الزامی است" }, { status: 400 });
    const course = await dependencies.db.course.findUnique({ where: { id: body.courseId } });
    if (!course || !course.published) return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    if (course.scheduleStatus !== "upcoming") return NextResponse.json({ error: "این دوره در حال حاضر پذیرش فرم ثبت‌نام ندارد" }, { status: 400 });
    const existingApplication = await dependencies.db.courseApplication.findUnique({ where: { userId_courseId: { userId: token.id, courseId: body.courseId } } });
    if (existingApplication) {
      if (existingApplication.status === "pending" || existingApplication.status === "pending_payment") return NextResponse.json({ application: existingApplication, profileUpdated: false, finalAmountTomans: existingApplication.finalAmountTomans });
      return NextResponse.json({ error: "قبلاً برای این دوره درخواست ثبت‌نام ارسال کرده‌اید" }, { status: 409 });
    }
    const savedForm = await dependencies.db.registrationForm.findUnique({ where: { id: 1 } });
    const formSchema = mergeRegistrationForm(parseRegistrationForm(savedForm?.schema), course.registrationFormOverride);
    const customResponses = body.customResponses && typeof body.customResponses === "object" && !Array.isArray(body.customResponses) ? body.customResponses as Record<string, string> : {};
    const customFields = formSchema.steps.flatMap((step) => step.fields).filter((field) => !field.system);
    if (customFields.some((field) => field.required && !String(customResponses[field.key] || "").trim())) return NextResponse.json({ error: "لطفاً تمام فیلدهای سفارشی الزامی را تکمیل کنید" }, { status: 400 });
     const requiredFields = ["courseId", "fullName", "email", "phone", "nationalCode", "birthDate", "gender", "province", "city", "address", "educationLevel", "educationField", "university", "universityField", "reason", "workHistory", "artHistory", "instagramId", "virtualPhone"];
    if (requiredFields.some((field) => typeof body[field] !== "string" || !body[field].trim())) return NextResponse.json({ error: "لطفاً تمام فیلدهای الزامی فرم را تکمیل کنید" }, { status: 400 });
    const fullName = body.fullName.trim().replace(/\s+/g, " ");
    if (!/^[آ-ی ]+$/.test(fullName) || fullName.split(" ").filter(Boolean).length < 2) return NextResponse.json({ error: "نام و نام خانوادگی را فقط با حروف فارسی وارد کنید" }, { status: 400 });
     if (body.knowsInstructors === true && !body.familiarityDetails?.trim()) return NextResponse.json({ error: "محل آشنایی قبلی با اساتید را وارد کنید" }, { status: 400 });
    const nationalCode = normalizeIranianNationalCode(body.nationalCode);
    if (!isValidIranianNationalCode(nationalCode)) return NextResponse.json({ error: "کد ملی واردشده معتبر نیست" }, { status: 400 });
    const normalizedPhone = normalizeIranianMobile(body.phone);
    if (!isValidIranianMobile(normalizedPhone)) return NextResponse.json({ error: "شماره تلفن همراه واردشده معتبر نیست" }, { status: 400 });
    if (!["male", "female"].includes(body.gender)) return NextResponse.json({ error: "جنسیت انتخاب‌شده معتبر نیست" }, { status: 400 });
    const isTehran = body.province.trim() === "تهران" && body.city.trim() === "تهران";
    if (isTehran && (typeof body.district !== "string" || !body.district.trim())) return NextResponse.json({ error: "برای تهران، منطقه محل سکونت را انتخاب کنید" }, { status: 400 });
    await dependencies.ensureDiscounts();
    const discountGroup = typeof body.discountGroup === "string" ? body.discountGroup.trim() : "";
    const enteredDiscountCode = typeof body.discountCode === "string" ? body.discountCode.trim() : "";
    if (discountGroup && !enteredDiscountCode) return NextResponse.json({ error: "برای تأیید گروه تخفیف، کد تخفیف را وارد کنید" }, { status: 400 });
    const discount = enteredDiscountCode ? await dependencies.findDiscount(enteredDiscountCode, true) : null;
    if (enteredDiscountCode && !discount) return NextResponse.json({ error: "کد تخفیف معتبر نیست" }, { status: 400 });
    if (discountGroup && discount?.label !== discountGroup) return NextResponse.json({ error: "این کد تخفیف متعلق به گروه انتخاب‌شده نیست" }, { status: 400 });
    const existingUser = await dependencies.db.user.findUnique({ where: { id: token.id } });
    if (!existingUser) return NextResponse.json({ error: "حساب کاربری پیدا نشد" }, { status: 404 });
    const email = body.email.trim().toLowerCase();
    const phone = normalizedPhone;
    const profileUpdated = existingUser.name !== fullName || existingUser.email !== email || existingUser.phone !== phone || existingUser.nationalCode !== nationalCode;

    const application = await dependencies.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: token.id }, data: {
         name: fullName, email, phone, birthDate: body.birthDate.trim(), gender: body.gender, province: body.province.trim(), city: body.city.trim(), district: isTehran ? body.district.trim() : null, neighborhood: isTehran ? (body.neighborhood?.trim() || null) : null, address: body.address.trim(), postalCode: body.postalCode?.trim() || null,
        workHistory: body.workHistory?.trim() || null, artHistory: body.artHistory?.trim() || null,
        educationLevel: body.educationLevel.trim(), educationField: body.educationField.trim(), university: body.university.trim(), universityField: body.universityField.trim(), instagramId: body.instagramId?.trim() || null,
        virtualPhone: body.virtualPhone.trim(), landline: body.landline?.trim() || null, nationalCode,
      } });
      const created = await tx.courseApplication.create({ data: {
        userId: token.id, courseId: body.courseId, fullName, email, phone, nationalCode,
         birthDate: body.birthDate.trim(), gender: body.gender,
         province: body.province.trim(), city: body.city.trim(), district: isTehran ? body.district.trim() : null, neighborhood: isTehran ? (body.neighborhood?.trim() || null) : null, address: body.address.trim(), postalCode: body.postalCode?.trim() || "",
        workHistory: body.workHistory?.trim() || null, artHistory: body.artHistory?.trim() || null,
        educationLevel: body.educationLevel.trim(), educationField: body.educationField.trim(), university: body.university.trim(), universityField: body.universityField.trim(), reason: body.reason.trim(),
        knowsInstructors: Boolean(body.knowsInstructors), familiarityDetails: body.knowsInstructors ? body.familiarityDetails.trim() : null,
         instagramId: body.instagramId.trim(), virtualPhone: body.virtualPhone.trim(), landline: body.landline?.trim() || null,
         discountCode: discount?.code || null, discountLabel: discount?.label || null, discountPercent: discount?.percent || 0,
         finalAmountTomans: Math.round(course.price * (100 - (discount?.percent || 0)) / 100),
        status: "pending", formSchema: JSON.stringify(formSchema), customResponses: JSON.stringify(customResponses),
      }, include: { course: { select: { title: true } } } });
      await queueCourseApplicationEvent(tx, created, created.createdAt);
      return created;
    });
    await dependencies.notify({ ...existingUser, name: fullName, email, phone }, course);
    try {
      await dependencies.notifyAdminsPush(buildAdminApplicationPush(application));
    } catch (error) {
      console.error("Admin push notification failed:", error);
    }
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
