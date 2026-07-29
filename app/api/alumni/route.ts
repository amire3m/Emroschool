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
    const alumni = await prisma.alumni.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json({ alumni });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت هنرآموختگان" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, field, batch, quote, imageUrl, achievements, order, showOnSite } = body;

    if (!name) {
      return NextResponse.json({ error: "نام الزامی است" }, { status: 400 });
    }

    const alumni = await prisma.alumni.create({
      data: {
        name,
        field: field || "",
        batch: batch || "",
        quote: quote || "",
        imageUrl: imageUrl || null,
        achievements: achievements || null,
        order: order ?? 0,
        showOnSite: showOnSite ?? true,
      },
    });

    return NextResponse.json({ alumni }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ایجاد هنرآموخته" }, { status: 500 });
  }
}
