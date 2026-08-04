import prisma from "@/lib/prisma";
import { getUserFromToken, hashPassword } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "توکن معتبر نیست" }, { status: 401 });
  }

  const payload = await getUserFromToken(authHeader.slice(7));
  if (!payload || !["admin", "superadmin"].includes(payload.role)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  if (payload.role !== "superadmin" && payload.permissions) { try { const permissions = JSON.parse(payload.permissions); if (Array.isArray(permissions) && permissions.length && !permissions.includes("users")) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); } catch { return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); } }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        role: true,
        userType: true,
        permissions: true,
        profileVisible: true,
        profileApprovalStatus: true,
        profileReviewedAt: true,
        profileRejectionReason: true,
        avatar: true,
        phone: true,
        balePhone: true,
        nationalCode: true,
        phoneVerified: true,
        bio: true,
        expertise: true,
        socialLinks: true,
        birthDate: true,
        gender: true,
        province: true,
        city: true,
        district: true,
        neighborhood: true,
        address: true,
        postalCode: true,
        educationLevel: true,
        educationField: true,
        university: true,
        universityField: true,
        workHistory: true,
        artHistory: true,
        instagramId: true,
        virtualPhone: true,
        landline: true,
        newsletterSubscribed: true,
        notificationEmailEnabled: true,
        notificationSmsEnabled: true,
        notificationBaleEnabled: true,
        avatarSubmissions: { orderBy: { submittedAt: "desc" }, take: 1, select: { id: true, imageUrl: true, status: true, rejectionReason: true, submittedAt: true } },
        createdAt: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = users.map(({ _count, ...user }) => ({ ...user, enrollmentCount: _count.enrollments }));

    return NextResponse.json({ users: result });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت کاربران" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const payload = authHeader?.startsWith("Bearer ") ? await getUserFromToken(authHeader.slice(7)) : null;
  if (!payload || !["admin", "superadmin"].includes(payload.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  if (payload.role !== "superadmin" && payload.permissions) { try { const permissions = JSON.parse(payload.permissions); if (Array.isArray(permissions) && permissions.length && !permissions.includes("users")) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); } catch { return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); } }

  try {
    const { name, email, password, userType = "student" } = await req.json();
    if (!name?.trim() || !email?.trim() || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "نام، ایمیل و رمز عبور حداقل ۶ کاراکتری الزامی است" }, { status: 400 });
    }
    if (!["student", "instructor", "alumni"].includes(userType)) return NextResponse.json({ error: "نوع کاربر نامعتبر است" }, { status: 400 });

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
