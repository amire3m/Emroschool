import prisma from "@/lib/prisma";
import { emailShell, htmlEscape, sendSiteEmail } from "@/lib/email";

type Recipient = { id: string; name: string; email: string; notificationEmailEnabled: boolean };

export async function sendProfileRejectionNotification(recipient: Recipient, reason: string) {
  const title = "پروفایل شما نیاز به اصلاح دارد";
  const message = `پروفایل شما بررسی شد و نیاز به اصلاح دارد. دلیل: ${reason}\n\nپس از اصلاح اطلاعات، می‌توانید دوباره آن را برای بررسی ارسال کنید.`;
  await prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({ data: { title, message, type: "in-app", channel: "in-app", sendToAll: false, sentAt: new Date() } });
    await tx.userNotification.create({ data: { userId: recipient.id, notificationId: notification.id } });
  });
  if (!recipient.notificationEmailEnabled) return;
  try {
    await sendSiteEmail({ to: recipient.email, subject: `${title} | آکادمی امام روح‌الله`, text: `سلام ${recipient.name}\n\n${message}`, html: emailShell(`<h1 style="margin:0;color:#03004b;font-size:24px">${htmlEscape(title)}</h1><p style="margin:20px 0 0;font-size:15px;line-height:2.2">سلام ${htmlEscape(recipient.name)}،<br>${htmlEscape(message).replace(/\n/g, "<br>")}</p>`) });
  } catch (error) { console.error("Profile rejection email failed:", error); }
}

export async function sendAvatarRejectionNotification(recipient: Recipient, reason: string) {
  const title = "تصویر پروفایل شما نیاز به تغییر دارد";
  const message = `تصویر پروفایل شما تایید نشد. دلیل: ${reason}\n\nمی‌توانید تصویر جدیدی بارگذاری کنید. پروفایل شما بدون تصویر همچنان قابل بررسی و تایید است.`;
  await prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({ data: { title, message, type: "in-app", channel: "in-app", sendToAll: false, sentAt: new Date() } });
    await tx.userNotification.create({ data: { userId: recipient.id, notificationId: notification.id } });
  });
  if (!recipient.notificationEmailEnabled) return;
  try {
    await sendSiteEmail({ to: recipient.email, subject: `${title} | آکادمی امام روح‌الله`, text: `سلام ${recipient.name}\n\n${message}`, html: emailShell(`<h1 style="margin:0;color:#03004b;font-size:24px">${htmlEscape(title)}</h1><p style="margin:20px 0 0;font-size:15px;line-height:2.2">سلام ${htmlEscape(recipient.name)}،<br>${htmlEscape(message).replace(/\n/g, "<br>")}</p>`) });
  } catch (error) { console.error("Avatar rejection email failed:", error); }
}
