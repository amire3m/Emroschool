import prisma from "@/lib/prisma";
import { getUserFromToken, hashPassword } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

async function getAdmin(token: string | null) {
  if (!token) return null;
  const user = await getUserFromToken(token);
  if (!user || !["admin", "superadmin"].includes(user.role)) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try { const permissions = JSON.parse(user.permissions); return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("users")) ? user : null; } catch { return null; }
}

const roles = ["user", "admin", "superadmin"];
const userTypes = ["student", "instructor", "alumni", "admin"];
const allowedPermissions = ["courses", "applications", "events", "news", "instructors", "gallery", "files", "slider", "notifications", "users", "settings", "payments", "discounts", "support", "impersonate"];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = req.headers.get("authorization");
  const admin = authHeader?.startsWith("Bearer ") ? await getAdmin(authHeader.slice(7)) : null;
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { role, userType, permissions, profileVisible, password, ...profile } = body;
    const targetUser = await prisma.user.findUnique({ where: { id: params.id } });
    if (!targetUser) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });

    if (role !== undefined && !roles.includes(role)) {
      return NextResponse.json({ error: "نقش سیستمی نامعتبر است" }, { status: 400 });
    }
    if (userType !== undefined && !userTypes.includes(userType)) {
      return NextResponse.json({ error: "نوع کاربر نامعتبر است" }, { status: 400 });
    }
    if ((role === "superadmin" || targetUser.role === "superadmin") && admin.role !== "superadmin") {
      return NextResponse.json({ error: "فقط مدیر ارشد می‌تواند این نقش را واگذار کند" }, { status: 403 });
    }
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 6) return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
      if (targetUser.role === "superadmin" && admin.role !== "superadmin") return NextResponse.json({ error: "فقط مدیر ارشد می‌تواند رمز مدیر ارشد را تغییر دهد" }, { status: 403 });
    }

    let normalizedPermissions: string | null | undefined;
    if (permissions !== undefined) {
      if (!permissions) {
        normalizedPermissions = null;
      } else {
        try {
          const parsed = typeof permissions === "string" ? JSON.parse(permissions) : permissions;
          if (!Array.isArray(parsed) || parsed.some((permission) => !allowedPermissions.includes(permission))) {
            throw new Error();
          }
          normalizedPermissions = JSON.stringify([...new Set(parsed)]);
        } catch {
          return NextResponse.json({ error: "ساختار دسترسی‌ها نامعتبر است" }, { status: 400 });
        }
      }
    }

    const data: Record<string, unknown> = {};
    const textFields = ["name", "phone", "balePhone", "nationalCode", "birthDate", "gender", "province", "city", "district", "neighborhood", "address", "postalCode", "workHistory", "artHistory", "educationLevel", "educationField", "university", "universityField", "instagramId", "virtualPhone", "landline", "bio", "expertise", "socialLinks"];
    for (const field of textFields) {
      if (profile[field] !== undefined) {
        if (typeof profile[field] !== "string") return NextResponse.json({ error: "مقدار یکی از فیلدهای کاربر نامعتبر است" }, { status: 400 });
        const value = profile[field].trim();
        if (value.length > 5000) return NextResponse.json({ error: "متن یکی از فیلدها بیش از حد طولانی است" }, { status: 400 });
        data[field] = value || null;
      }
    }
    if (profile.name !== undefined && !String(profile.name).trim()) return NextResponse.json({ error: "نام کاربر الزامی است" }, { status: 400 });
    if (profile.email !== undefined) {
      const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
      if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });
      data.email = email;
      data.emailVerified = true;
    }
    if (profile.phone !== undefined && profile.phone && !/^09\d{9}$/.test(String(profile.phone).replace(/\D/g, ""))) return NextResponse.json({ error: "شماره موبایل معتبر وارد کنید" }, { status: 400 });
    if (profile.phone !== undefined) data.phoneVerified = Boolean(profile.phone);
    for (const field of ["newsletterSubscribed", "notificationEmailEnabled", "notificationSmsEnabled", "notificationBaleEnabled"]) {
      if (profile[field] !== undefined) { if (typeof profile[field] !== "boolean") return NextResponse.json({ error: "تنظیمات اعلان نامعتبر است" }, { status: 400 }); data[field] = profile[field]; }
    }
    if (role !== undefined) data.role = role;
    if (userType !== undefined) data.userType = userType;
    if (normalizedPermissions !== undefined) data.permissions = normalizedPermissions;
    if (profileVisible !== undefined && typeof profileVisible === "boolean") {
      if (profileVisible && targetUser.profileApprovalStatus !== "approved") return NextResponse.json({ error: "نمایش عمومی پروفایل فقط پس از تایید مجاز است" }, { status: 409 });
      data.profileVisible = profileVisible;
    }
    if (password) data.password = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.id },
        data,
        select: {
          id: true, name: true, email: true, role: true, userType: true,
          permissions: true, profileVisible: true, profileApprovalStatus: true, profileReviewedAt: true,
        },
      });

      if (userType === "instructor") {
        const archived = await tx.instructor.findUnique({ where: { archivedUserId: params.id } });
        if (archived) await tx.instructor.update({ where: { id: archived.id }, data: { userId: params.id, archivedUserId: null, archivedAt: null, showOnSite: true } });
        else
        await tx.instructor.upsert({
          where: { userId: params.id },
          update: {},
          create: { userId: params.id, name: updated.name, showOnSite: true },
        });
      }
      if (userType === "alumni") {
        const archived = await tx.alumni.findUnique({ where: { archivedUserId: params.id } });
        if (archived) await tx.alumni.update({ where: { id: archived.id }, data: { userId: params.id, archivedUserId: null, archivedAt: null, showOnSite: true } });
        else
        await tx.alumni.upsert({
          where: { userId: params.id },
          update: {},
          create: { userId: params.id, name: updated.name, field: "", batch: "", quote: "", showOnSite: true },
        });
      }
      if (userType !== undefined && userType !== "instructor") await tx.instructor.updateMany({ where: { userId: params.id }, data: { userId: null, archivedUserId: params.id, archivedAt: new Date(), showOnSite: false } });
      if (userType !== undefined && userType !== "alumni") await tx.alumni.updateMany({ where: { userId: params.id }, data: { userId: null, archivedUserId: params.id, archivedAt: new Date(), showOnSite: false } });
      const changedFields = Object.keys(data).filter((field) => field !== "password");
      if (password) changedFields.push("password");
      if (changedFields.length) await tx.userAuditLog.create({ data: { actorId: admin.id, targetUserId: params.id, action: "update", fields: JSON.stringify(changedFields) } });

      return updated;
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی کاربر" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = req.headers.get("authorization");
  const admin = authHeader?.startsWith("Bearer ") ? await getAdmin(authHeader.slice(7)) : null;
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  if (admin.id === params.id) return NextResponse.json({ error: "امکان حذف حساب کاربری خودتان وجود ندارد" }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
  if (target.role !== "user" && admin.role !== "superadmin") return NextResponse.json({ error: "فقط مدیر ارشد می‌تواند حساب مدیران را حذف کند" }, { status: 403 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "کاربر حذف شد" });
}
