import crypto from "crypto";
import prisma from "@/lib/prisma";
import { emailShell, htmlEscape, sendSiteEmail } from "@/lib/email";

const secret = process.env.VERIFICATION_SECRET || process.env.JWT_SECRET || "verification-secret-1405";
const hashCode = (destination: string, code: string) => crypto.createHmac("sha256", secret).update(`${destination}:${code}`).digest("hex");

export async function issueEmailVerificationCode(email: string, name: string) {
  const normalized = email.trim().toLowerCase();
  const latest = await prisma.verificationCode.findFirst({ where: { destination: normalized, channel: "email", purpose: "register" }, orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) throw new Error("RATE_LIMIT");
  const code = crypto.randomInt(100000, 1000000).toString();
  await prisma.verificationCode.deleteMany({ where: { destination: normalized, channel: "email", purpose: "register" } });
  const record = await prisma.verificationCode.create({ data: { destination: normalized, channel: "email", codeHash: hashCode(normalized, code), purpose: "register", expiresAt: new Date(Date.now() + 10 * 60_000) } });
  try {
    const safeName = htmlEscape(name);
    await sendSiteEmail({
      to: normalized,
      subject: "کد تأیید ثبت‌نام | آکادمی امام روح‌الله",
      text: `${name} عزیز، کد تأیید شما ${code} است. این کد تا ۱۰ دقیقه معتبر است.`,
      html: emailShell(`<div style="text-align:center"><div style="display:inline-block;padding:10px 16px;border-radius:999px;background:#fff3dc;color:#7b5814;font-size:12px;font-weight:bold">یک قدم تا ورود به آکادمی</div><h1 style="margin:22px 0 10px;color:#03004b;font-size:27px">تأیید ایمیل شما</h1><p style="margin:0;color:#777681;line-height:2">${safeName} عزیز، برای تکمیل ثبت‌نام این کد را در صفحه آکادمی وارد کنید.</p><div style="margin:28px 0;padding:24px 12px;border-radius:20px;background:linear-gradient(135deg,#fbf8ff,#fff7e9);border:1px solid #ffdeab;color:#03004b;font-size:38px;font-weight:900;letter-spacing:12px;direction:ltr">${code}</div><p style="margin:0;color:#777681;font-size:12px;line-height:2">این کد تا ۱۰ دقیقه معتبر است و فقط یک‌بار قابل استفاده است.<br>اگر شما درخواست ثبت‌نام نداده‌اید، این پیام را نادیده بگیرید.</p></div>`, "کد تأیید ثبت‌نام آکادمی"),
    });
  } catch (error) {
    await prisma.verificationCode.delete({ where: { id: record.id } }).catch(() => {});
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  const safeName = htmlEscape(name);
  await sendSiteEmail({
    to: email,
    subject: "به خانواده آکادمی امام روح‌الله خوش آمدید",
    text: `${name} عزیز، به آکادمی هنر و رسانه امام روح‌الله خوش آمدید.`,
    html: emailShell(`<div><div style="display:inline-block;padding:10px 16px;border-radius:999px;background:#fff3dc;color:#7b5814;font-size:12px;font-weight:bold">خوش آمدی، هنرمند</div><h1 style="margin:22px 0 12px;color:#03004b;font-size:30px">${safeName} عزیز،<br>به آکادمی خوش آمدی</h1><p style="color:#555568;line-height:2.2;font-size:15px">از اینکه به جمع هنرمندان متعهد و خلاق آکادمی هنر و رسانه امام روح‌الله پیوستی خوشحالیم. اینجا قرار است یاد بگیری، تجربه کنی و اثری ماندگار بسازی.</p><div style="margin:26px 0;padding:20px;border-radius:18px;background:#03004b;color:#fff"><div style="color:#ffdeab;font-size:12px;font-weight:bold">مسیر تو از همین‌جا آغاز می‌شود</div><div style="margin-top:8px;font-size:18px;font-weight:bold">دوره‌ها را ببین، در رویدادها همراه شو و رشد کن.</div></div><a href="https://imamruhollahschool.com/courses" style="display:inline-block;padding:14px 24px;background:#7b5814;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold">مشاهده دوره‌ها</a></div>`, "خوش آمدید به آکادمی امام روح‌الله"),
  });
}

export async function verifyEmailCode(email: string, code: string) {
  const normalized = email.trim().toLowerCase();
  const record = await prisma.verificationCode.findFirst({ where: { destination: normalized, channel: "email", purpose: "register" }, orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date()) return { valid: false, reason: "expired" } as const;
  if (record.attempts >= 5) return { valid: false, reason: "attempts" } as const;
  if (record.codeHash !== hashCode(normalized, code)) {
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { valid: false, reason: "invalid" } as const;
  }
  await prisma.verificationCode.delete({ where: { id: record.id } });
  return { valid: true } as const;
}
