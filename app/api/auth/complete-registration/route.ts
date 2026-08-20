import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7)) : null;
  if (!token) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const { province, city, district, neighborhood, discoverySource } = await req.json();
  if (![province, city, discoverySource].every((value) => typeof value === "string" && value.trim())) {
    return NextResponse.json({ error: "استان، شهر و نحوه آشنایی با سایت الزامی است" }, { status: 400 });
  }
  if (province === "تهران" && (!district || typeof district !== "string" || !district.trim())) {
    return NextResponse.json({ error: "برای تهران، منطقه را انتخاب کنید" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: token.id },
    data: {
      province: province.trim(), city: city.trim(), district: province === "تهران" ? district.trim() : null,
      neighborhood: province === "تهران" ? (neighborhood?.trim() || null) : null,
      discoverySource: discoverySource.trim(), registrationCompleted: true,
    },
  });
  return NextResponse.json({ success: true });
}
