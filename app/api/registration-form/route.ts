import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole, verifyToken } from "@/lib/auth";
import { defaultRegistrationForm, mergeRegistrationForm, parseRegistrationForm, validateRegistrationForm } from "@/lib/registration-form";
import { NextRequest, NextResponse } from "next/server";

function token(req: NextRequest) {
  const value = req.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function canManage(req: NextRequest) {
  const value = token(req);
  const payload = value ? verifyToken(value) : null;
  if (!payload || !isAdminRole(payload.role)) return false;
  const user = await getUserFromToken(value!);
  if (!user || user.role === "superadmin" || !user.permissions) return Boolean(user);
  try { const permissions = JSON.parse(user.permissions); return !permissions.length || permissions.includes("applications"); } catch { return false; }
}

export async function GET(req: NextRequest) {
  try {
    const courseId = new URL(req.url).searchParams.get("courseId");
    const saved = await prisma.registrationForm.findUnique({ where: { id: 1 } });
    const globalSchema = parseRegistrationForm(saved?.schema) || defaultRegistrationForm;
    if (!courseId) return NextResponse.json({ schema: globalSchema });
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { registrationFormOverride: true } });
    if (!course) return NextResponse.json({ error: "دوره پیدا نشد" }, { status: 404 });
    return NextResponse.json({ schema: mergeRegistrationForm(globalSchema, course.registrationFormOverride), isOverride: Boolean(course.registrationFormOverride) });
  } catch { return NextResponse.json({ error: "خطا در دریافت فرم ثبت‌نام" }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  if (!await canManage(req)) return NextResponse.json({ error: "دسترسی مدیریت فرم ثبت‌نام را ندارید" }, { status: 403 });
  try {
    const { schema, courseId, clearOverride } = await req.json();
    if (clearOverride && typeof courseId === "string") {
      await prisma.course.update({ where: { id: courseId }, data: { registrationFormOverride: null } });
      return NextResponse.json({ ok: true });
    }
    if (!validateRegistrationForm(schema)) return NextResponse.json({ error: "ساختار فرم معتبر نیست؛ فیلدهای سیستمی قابل حذف نیستند" }, { status: 400 });
    const content = JSON.stringify(schema);
    if (typeof courseId === "string" && courseId) await prisma.course.update({ where: { id: courseId }, data: { registrationFormOverride: content } });
    else await prisma.registrationForm.upsert({ where: { id: 1 }, create: { id: 1, schema: content }, update: { schema: content } });
    return NextResponse.json({ schema });
  } catch { return NextResponse.json({ error: "ذخیره فرم ثبت‌نام انجام نشد" }, { status: 500 }); }
}
