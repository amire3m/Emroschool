import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { ensureDiscountCodes } from "@/lib/discount-codes";
import { NextRequest, NextResponse } from "next/server";

async function admin(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !isAdminRole(user.role)) return null;
  if (user.role !== "superadmin" && user.permissions) {
    try { const permissions = JSON.parse(user.permissions); if (permissions.length && !permissions.includes("discounts") && !permissions.includes("settings")) return null; } catch { return null; }
  }
  return user;
}

function data(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const percent = typeof value.percent === "number" ? value.percent : Number(value.percent);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code) || !label || label.length > 120 || !Number.isInteger(percent) || percent < 0 || percent > 100) return null;
  return { code, label, percent, active: typeof value.active === "boolean" ? value.active : true, requiresDocument: typeof value.requiresDocument === "boolean" ? value.requiresDocument : true };
}

async function codeExists(code: string, exceptId?: string) {
  const codes = await prisma.discountCode.findMany({ select: { id: true, code: true } });
  return codes.some((discount) => discount.id !== exceptId && discount.code.toLocaleLowerCase() === code.toLocaleLowerCase());
}

export async function GET(req: NextRequest) {
  if (!await admin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  await ensureDiscountCodes();
  return NextResponse.json({ discountCodes: await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } }) });
}

export async function POST(req: NextRequest) {
  if (!await admin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const value = data(await req.json());
    if (!value) return NextResponse.json({ error: "اطلاعات کد تخفیف نامعتبر است" }, { status: 400 });
    if (await codeExists(value.code)) return NextResponse.json({ error: "این کد تخفیف قبلاً ثبت شده است" }, { status: 409 });
    return NextResponse.json({ discountCode: await prisma.discountCode.create({ data: value }) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این کد تخفیف قبلاً ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "ایجاد کد تخفیف انجام نشد" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await admin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const body = await req.json();
    if (typeof body.id !== "string") return NextResponse.json({ error: "شناسه کد تخفیف نامعتبر است" }, { status: 400 });
    const value = data(body);
    if (!value) return NextResponse.json({ error: "اطلاعات کد تخفیف نامعتبر است" }, { status: 400 });
    if (await codeExists(value.code, body.id)) return NextResponse.json({ error: "این کد تخفیف قبلاً ثبت شده است" }, { status: 409 });
    return NextResponse.json({ discountCode: await prisma.discountCode.update({ where: { id: body.id }, data: value }) });
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return NextResponse.json({ error: "کد تخفیف پیدا نشد" }, { status: 404 });
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این کد تخفیف قبلاً ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "ویرایش کد تخفیف انجام نشد" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await admin(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const { id } = await req.json();
    if (typeof id !== "string") return NextResponse.json({ error: "شناسه کد تخفیف نامعتبر است" }, { status: 400 });
    await prisma.discountCode.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return NextResponse.json({ error: "کد تخفیف پیدا نشد" }, { status: 404 });
    return NextResponse.json({ error: "حذف کد تخفیف انجام نشد" }, { status: 500 });
  }
}
