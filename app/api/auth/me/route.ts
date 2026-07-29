import { getUserFromToken } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "توکن معتبر نیست" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json({ error: "توکن منقضی یا نامعتبر است" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "خطا در دریافت اطلاعات کاربر" }, { status: 500 });
  }
}
