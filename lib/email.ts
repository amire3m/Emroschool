import nodemailer from "nodemailer";

export function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

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

export function emailShell(content: string, preheader = "آکادمی هنر و رسانه امام روح‌الله") {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${preheader}</title></head><body style="margin:0;background:#f3f1fb;font-family:Tahoma,Arial,sans-serif;color:#17172a"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f1fb;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 18px 55px rgba(3,0,75,.12)"><tr><td style="height:8px;background:linear-gradient(90deg,#7b5814,#ffdeab,#03004b)"></td></tr><tr><td style="padding:28px 34px 20px;background:#03004b;color:#fff"><div style="font-size:13px;color:#ffdeab;font-weight:bold;letter-spacing:1px">آکادمی هنر و رسانه</div><div style="font-size:25px;font-weight:900;margin-top:8px">امام روح‌الله (ره)</div></td></tr><tr><td style="padding:34px">${content}</td></tr><tr><td style="padding:20px 34px;background:#faf9ff;border-top:1px solid #eeecfc;color:#777681;font-size:12px;line-height:2.1">این پیام به‌صورت خودکار از طرف آکادمی هنر و رسانه امام روح‌الله ارسال شده است.<br>هنر متعالی، رسانه انقلابی</td></tr></table></td></tr></table></body></html>`;
}

export async function sendSiteEmail({ to, subject, text, html, from }: { to: string; subject: string; text: string; html: string; from?: string }) {
  return emailTransport().sendMail({
    from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
