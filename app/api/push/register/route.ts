import { getUserFromToken } from "@/lib/auth";
import { parsePushSubscriptionInput, registerPushSubscription } from "@/lib/push";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

    const parsed = parsePushSubscriptionInput(body);
    if (!parsed) {
      return NextResponse.json({ error: "اشتراک push معتبر نیست" }, { status: 400 });
    }

    await registerPushSubscription({
      userId: user.id,
      endpoint: parsed.endpoint,
      keys: parsed.keys,
      userAgent: parsed.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push register error:", error);
    return NextResponse.json({ error: "خطا در ثبت اشتراک push" }, { status: 500 });
  }
}
