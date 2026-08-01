import crypto from "crypto";
import prisma from "@/lib/prisma";

const secret = process.env.VERIFICATION_SECRET || process.env.JWT_SECRET || "verification-secret-1405";

export function normalizeBalePhone(value: string) {
  const digits = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `98${digits.slice(1)}`;
  if (/^989\d{9}$/.test(digits)) return digits;
  return "";
}

export function normalizeIranianPhone(value: string) {
  const digits = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return "";
}

function hashCode(destination: string, code: string) {
  return crypto.createHmac("sha256", secret).update(`${destination}:${code}`).digest("hex");
}

export async function issueBaleOtp(phone: string, purpose: string) {
  const destination = normalizeBalePhone(phone);
  if (!destination) throw new Error("INVALID_PHONE");
  const apiKey = process.env.BALE_SAFIR_API_KEY;
  const botId = process.env.BALE_BOT_ID;
  if (!apiKey || !botId) throw new Error("BALE_NOT_CONFIGURED");

  const latest = await prisma.verificationCode.findFirst({ where: { destination, channel: "bale", purpose }, orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) throw new Error("RATE_LIMIT");

  const code = crypto.randomInt(100000, 1000000).toString();
  const response = await fetch("https://safir.bale.ai/api/v3/send_message", {
    method: "POST",
    headers: { "api-access-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: crypto.randomUUID(), bot_id: Number(botId), phone_number: destination, message_data: { otp_message: { otp: code } } }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error_data?.length) {
    const code = result?.error_data?.[0]?.code;
    if (code === 17) throw new Error("NOT_BALE_USER");
    throw new Error("BALE_SEND_FAILED");
  }

  await prisma.verificationCode.deleteMany({ where: { destination, channel: "bale", purpose } });
  await prisma.verificationCode.create({ data: { destination, channel: "bale", purpose, codeHash: hashCode(destination, code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return destination;
}

export async function verifyBaleOtp(phone: string, code: string, purpose: string) {
  const destination = normalizeBalePhone(phone);
  const record = await prisma.verificationCode.findFirst({ where: { destination, channel: "bale", purpose }, orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date()) return { valid: false, reason: "expired" } as const;
  if (record.attempts >= 5) return { valid: false, reason: "attempts" } as const;
  if (record.codeHash !== hashCode(destination, code)) {
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { valid: false, reason: "invalid" } as const;
  }
  await prisma.verificationCode.delete({ where: { id: record.id } });
  return { valid: true, phone: destination } as const;
}

export async function issuePhoneOtp(phone: string, purpose: string, channel: "sms" | "call") {
  const destination = normalizeIranianPhone(phone);
  if (!destination) throw new Error("INVALID_PHONE");
  const apiKey = process.env.API_IR_TOKEN;
  if (!apiKey) throw new Error("SMS_NOT_CONFIGURED");
  const latest = await prisma.verificationCode.findFirst({ where: { destination, channel, purpose }, orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) throw new Error("RATE_LIMIT");
  const code = crypto.randomInt(100000, 1000000).toString();
  const response = await fetch(`https://s.api.ir/api/sw1/${channel === "sms" ? "SmsOTP" : "CallOTPalt"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(channel === "sms" ? { code, mobile: destination, template: 2 } : { code, number: destination }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !result?.data) throw new Error("PHONE_SEND_FAILED");
  await prisma.verificationCode.deleteMany({ where: { destination, channel, purpose } });
  await prisma.verificationCode.create({ data: { destination, channel, purpose, codeHash: hashCode(destination, code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return destination;
}

export async function verifyPhoneOtp(phone: string, code: string, purpose: string, channel: "sms" | "call") {
  const destination = normalizeIranianPhone(phone);
  const record = await prisma.verificationCode.findFirst({ where: { destination, channel, purpose }, orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date()) return { valid: false, reason: "expired" } as const;
  if (record.attempts >= 5) return { valid: false, reason: "attempts" } as const;
  if (record.codeHash !== hashCode(destination, code)) {
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { valid: false, reason: "invalid" } as const;
  }
  await prisma.verificationCode.delete({ where: { id: record.id } });
  return { valid: true, phone: destination } as const;
}
