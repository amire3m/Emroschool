import prisma from "@/lib/prisma";
import { hashPassword, isAdminRole, verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "توکن معتبر نیست" }, { status: 401 });
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload || !isAdminRole(payload.role)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userType: true,
        permissions: true,
        profileVisible: true,
        profileApprovalStatus: true,
        profileReviewedAt: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      userType: user.userType,
      permissions: user.permissions,
      profileVisible: user.profileVisible,
      profileApprovalStatus: user.profileApprovalStatus,
      profileReviewedAt: user.profileReviewedAt,
      createdAt: user.createdAt,
      enrollmentCount: user._count.enrollments,
    }));

    return NextResponse.json({ users: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت کاربران" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const payload = authHeader?.startsWith("Bearer ") ? verifyToken(authHeader.slice(7)) : null;
  if (!payload || !isAdminRole(payload.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  try {
    const { name, email, password, userType = "student" } = await req.json();
    if (!name?.trim() || !email?.trim() || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "نام، ایمیل و رمز عبور حداقل ۶ کاراکتری الزامی است" }, { status: 400 });
    }
    if (!["student", "instructor", "alumni", "admin"].includes(userType)) return NextResponse.json({ error: "نوع کاربر نامعتبر است" }, { status: 400 });

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), password: await hashPassword(password), userType, profileVisible: false } });
      if (userType === "instructor") await tx.instructor.create({ data: { userId: created.id, name: created.name, showOnSite: true } });
      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    return NextResponse.json({ error: "خطا در ایجاد کاربر" }, { status: 500 });
  }
}
