import crypto from "crypto";
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

const secret = process.env.VERIFICATION_SECRET || process.env.JWT_SECRET || "verification-secret-1405";
const hashCode = (destination: string, code: string) => crypto.createHmac("sha256", secret).update(`${destination}:${code}`).digest("hex");

function emailTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || Boolean(user) !== Boolean(pass)) throw new Error("EMAIL_NOT_CONFIGURED");
  const port = Number(process.env.SMTP_PORT || 587);
  const localRelay = host === "127.0.0.1" && port === 25 && !user && !pass;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(localRelay ? { ignoreTLS: true } : {}),
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

export async function issueEmailVerificationCode(email: string, name: string) {
  const normalized = email.trim().toLowerCase();
  const latest = await prisma.verificationCode.findFirst({ where: { destination: normalized, channel: "email", purpose: "register" }, orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) throw new Error("RATE_LIMIT");
  const code = crypto.randomInt(100000, 1000000).toString();
  await prisma.verificationCode.deleteMany({ where: { destination: normalized, channel: "email", purpose: "register" } });
  const record = await prisma.verificationCode.create({ data: { destination: normalized, channel: "email", codeHash: hashCode(normalized, code), purpose: "register", expiresAt: new Date(Date.now() + 10 * 60_000) } });
  try {
    await emailTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: normalized,
      subject: "کد تأیید ثبت‌نام آکادمی امام روح‌الله",
      text: `${name} عزیز، کد تأیید شما: ${code}\nاین کد تا ۱۰ دقیقه معتبر است.`,
      html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e1f0;border-radius:20px"><h2 style="color:#03004b">تأیید ایمیل آکادمی</h2><p>${name} عزیز، برای تکمیل ثبت‌نام کد زیر را وارد کنید:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#7b5814;text-align:center;padding:20px;background:#fbf8ff;border-radius:14px">${code}</div><p style="color:#777681;font-size:13px">این کد تا ۱۰ دقیقه معتبر است. اگر شما درخواست ثبت‌نام نداده‌اید، این ایمیل را نادیده بگیرید.</p></div>`,
    });
  } catch (error) {
    await prisma.verificationCode.delete({ where: { id: record.id } }).catch(() => {});
    throw error;
  }
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
