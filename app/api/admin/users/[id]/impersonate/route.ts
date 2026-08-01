import { generateToken, getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function impersonator(req: NextRequest) {
  const header = req.headers.get("authorization");
  const user = header?.startsWith("Bearer ") ? await getUserFromToken(header.slice(7)) : null;
  if (!user || !["admin", "superadmin"].includes(user.role)) return null;
  if (user.role === "superadmin" || !user.permissions) return user;
  try {
    const permissions = JSON.parse(user.permissions);
    return Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("impersonate")) ? user : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await impersonator(req);
  if (!actor) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, email: true, name: true, role: true, avatar: true } });
  if (!target) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
  if (target.role !== "user") return NextResponse.json({ error: "فقط امکان ورود به حساب کاربران عادی وجود دارد" }, { status: 403 });

  const token = generateToken({ id: target.id, email: target.email, role: "user" }, { expiresIn: "2h", impersonatedBy: actor.id });
  return NextResponse.json({ token, expiresIn: 7200, user: { id: target.id, name: target.name, email: target.email, avatar: target.avatar, role: target.role } });
}
