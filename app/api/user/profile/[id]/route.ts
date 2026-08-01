import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        expertise: true,
        socialLinks: true,
        role: true,
        userType: true,
        profileVisible: true,
        profileApprovalStatus: true,
        createdAt: true,
        instructor: {
          select: { specialties: true, showOnSite: true },
        },
        alumni: {
          select: { field: true, batch: true, quote: true, achievements: true, showOnSite: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    if (user.profileApprovalStatus !== "approved" || !user.profileVisible) {
      return NextResponse.json({ error: "این پروفایل عمومی نیست" }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت پروفایل" }, { status: 500 });
  }
}
