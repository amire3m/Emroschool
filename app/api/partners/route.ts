import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const payload = verifyToken(authHeader.slice(7));
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

export async function GET() {
  try {
    const partners = await prisma.partner.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ partners });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت همراهان" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const body = await req.json();
    const { name, logoUrl, order, showOnSite } = body;
    if (!name || !logoUrl) {
      return NextResponse.json({ error: "نام و لوگو الزامی است" }, { status: 400 });
    }
    const partner = await prisma.partner.create({
      data: {
        name,
        logoUrl,
        order: order ?? 0,
        showOnSite: showOnSite ?? true,
      },
    });
    return NextResponse.json({ partner }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ایجاد همراه" }, { status: 500 });
  }
}
