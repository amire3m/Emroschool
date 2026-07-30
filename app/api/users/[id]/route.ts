import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

function getAdmin(token: string | null) {
  if (!token) return false;
  const payload = verifyToken(token);
  return payload && (payload.role === "admin" || payload.role === "superadmin") ? payload : null;
}

const roles = ["user", "admin", "superadmin"];
const userTypes = ["student", "instructor", "alumni", "admin"];
const allowedPermissions = ["courses", "applications", "events", "news", "instructors", "gallery", "files", "slider", "notifications", "users", "settings"];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = req.headers.get("authorization");
  const admin = authHeader?.startsWith("Bearer ") ? getAdmin(authHeader.slice(7)) : null;
  if (!admin) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { role, userType, permissions, profileVisible } = body;

    if (role !== undefined && !roles.includes(role)) {
      return NextResponse.json({ error: "نقش سیستمی نامعتبر است" }, { status: 400 });
    }
    if (userType !== undefined && !userTypes.includes(userType)) {
      return NextResponse.json({ error: "نوع کاربر نامعتبر است" }, { status: 400 });
    }
    if (role === "superadmin" && admin.role !== "superadmin") {
      return NextResponse.json({ error: "فقط مدیر ارشد می‌تواند این نقش را واگذار کند" }, { status: 403 });
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
    if (role !== undefined) data.role = role;
    if (userType !== undefined) data.userType = userType;
    if (normalizedPermissions !== undefined) data.permissions = normalizedPermissions;
    if (profileVisible !== undefined && typeof profileVisible === "boolean") data.profileVisible = profileVisible;

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: params.id },
        data,
        select: {
          id: true, name: true, email: true, role: true, userType: true,
          permissions: true, profileVisible: true,
        },
      });

      if (userType === "instructor") {
        await tx.instructor.upsert({
          where: { userId: params.id },
          update: {},
          create: { userId: params.id, name: updated.name, showOnSite: true },
        });
      }
      if (userType === "alumni") {
        await tx.alumni.upsert({
          where: { userId: params.id },
          update: {},
          create: { userId: params.id, name: updated.name, field: "", batch: "", quote: "", showOnSite: true },
        });
      }

      return updated;
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "خطا در بروزرسانی کاربر" }, { status: 500 });
  }
}
