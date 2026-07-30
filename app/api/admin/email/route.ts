import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { emailShell, htmlEscape, sendSiteEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

function getToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const admin = token ? await getUserFromToken(token) : null;
    if (!admin || !isAdminRole(admin.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    if (admin.role !== "superadmin" && admin.permissions) {
      let permissions: string[] = [];
      try { permissions = JSON.parse(admin.permissions); } catch { return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }); }
      if (permissions.length > 0 && !permissions.includes("settings")) return NextResponse.json({ error: "دسترسی ارسال ایمیل را ندارید" }, { status: 403 });
    }

    const body = await req.json();
    const to = String(body.to || "").trim().toLowerCase();
    const senderName = String(body.senderName || "").trim();
    const senderUsername = String(body.senderUsername || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) return NextResponse.json({ error: "نشانی گیرنده معتبر نیست" }, { status: 400 });
    if (!senderName || !/^[a-z0-9][a-z0-9._-]{1,30}$/.test(senderUsername) || !subject || !message) return NextResponse.json({ error: "تمام فیلدهای ایمیل را تکمیل کنید" }, { status: 400 });

    const safeSubject = htmlEscape(subject);
    const safeMessage = htmlEscape(message).replace(/\r?\n/g, "<br>");
    await sendSiteEmail({
      to,
      subject,
      text: message,
      from: `${senderName} <${senderUsername}@imamruhollahschool.com>`,
      html: emailShell(`<div><div style="display:inline-block;padding:9px 14px;border-radius:999px;background:#fff3dc;color:#7b5814;font-size:12px;font-weight:bold">پیام ویژه آکادمی</div><h1 style="margin:22px 0 12px;color:#03004b;font-size:27px">${safeSubject}</h1><div style="padding:22px;border-radius:18px;background:#fbf8ff;border:1px solid #e2e1f0;color:#454557;font-size:15px;line-height:2.2">${safeMessage}</div><p style="margin:24px 0 0;color:#777681;font-size:12px">این پیام از طرف ${htmlEscape(senderName)} ارسال شده است.</p></div>`, subject),
    });
    return NextResponse.json({ message: "ایمیل با موفقیت ارسال شد" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_NOT_CONFIGURED") return NextResponse.json({ error: "سرویس ارسال ایمیل پیکربندی نشده است" }, { status: 503 });
    console.error("Admin email error:", error);
    return NextResponse.json({ error: "ارسال ایمیل انجام نشد" }, { status: 500 });
  }
}
