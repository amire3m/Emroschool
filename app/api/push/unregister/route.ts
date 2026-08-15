import { getUserFromToken } from "@/lib/auth";
import { unregisterPushSubscription } from "@/lib/push";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "توکن معتبر نیست" }, { status: 401 });
    }

    const user = await getUserFromToken(authHeader.slice(7));
    if (!user) {
      return NextResponse.json({ error: "توکن منقضی یا نامعتبر است" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "بدنه درخواست معتبر نیست" }, { status: 400 });
    }

    const endpoint = (body as Record<string, unknown> | null)?.endpoint;
    if (typeof endpoint !== "string" || endpoint.length === 0) {
      return NextResponse.json({ error: "endpoint معتبر نیست" }, { status: 400 });
    }

    await unregisterPushSubscription({ userId: user.id, endpoint });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push unregister error:", error);
    return NextResponse.json({ error: "خطا در حذف اشتراک push" }, { status: 500 });
  }
}
