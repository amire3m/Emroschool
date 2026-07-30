import prisma from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

async function canManageMagazine(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const user = await getUserFromToken(authorization.slice(7));
  if (!user || !["admin", "superadmin"].includes(user.role)) return false;
  if (user.role === "superadmin" || !user.permissions) return true;
  try { const permissions = JSON.parse(user.permissions); return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("news")); } catch { return false; }
}

export async function GET() {
  try {
    const settings = await prisma.magazineSetting.findFirst() || await prisma.magazineSetting.create({ data: {} });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Magazine settings GET error:", error);
    return NextResponse.json({ error: "خطا در دریافت تنظیمات مجله" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await canManageMagazine(req)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  try {
    const body = await req.json();
    const clean = {
      title: String(body.title || "").trim(), description: String(body.description || "").trim(), logo: body.logo || null,
      heroLabel: String(body.heroLabel || "").trim(), heroTitle: String(body.heroTitle || "").trim(),
      heroHighlight: String(body.heroHighlight || "").trim(), heroDescription: String(body.heroDescription || "").trim(),
      accentColor: /^#[0-9a-fA-F]{6}$/.test(body.accentColor) ? body.accentColor : "#ffdeab",
      font: body.font === "kay" ? "kay" : "foran",
    };
    if (!clean.title || !clean.heroLabel || !clean.heroTitle || !clean.heroHighlight) return NextResponse.json({ error: "عنوان‌های اصلی مجله الزامی هستند" }, { status: 400 });
    const existing = await prisma.magazineSetting.findFirst();
    const settings = existing ? await prisma.magazineSetting.update({ where: { id: existing.id }, data: clean }) : await prisma.magazineSetting.create({ data: clean });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Magazine settings POST error:", error);
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات مجله" }, { status: 500 });
  }
}
