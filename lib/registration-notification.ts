import prisma from "@/lib/prisma";
import { emailShell, htmlEscape, sendSiteEmail } from "@/lib/email";

type Recipient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  balePhone: string | null;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
  notificationBaleEnabled: boolean;
};

async function sendConfiguredChannel(url: string | undefined, token: string | undefined, destination: string | null, message: string, channel: string) {
  if (!url || !destination) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ destination, message }),
  });
  if (!response.ok) throw new Error(`${channel}_NOTIFICATION_FAILED`);
}

export async function sendInitialCourseRegistrationNotification(recipient: Recipient, course: { id: string; title: string }) {
  const title = "ثبت‌نام اولیه با موفقیت انجام شد";
  const message = `ثبت‌نام اولیه شما در دوره «${course.title}» با موفقیت انجام شد. درخواست شما در انتظار بررسی است.`;

  await prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({ data: { title, message, type: "in-app", channel: "in-app", sendToAll: false, courseId: course.id, sentAt: new Date() } });
    await tx.userNotification.create({ data: { userId: recipient.id, notificationId: notification.id } });
  });

  const deliveries: Promise<unknown>[] = [];
  if (recipient.notificationEmailEnabled) {
    deliveries.push(sendSiteEmail({
      to: recipient.email,
      subject: `${title} | آکادمی امام روح‌الله`,
      text: `سلام ${recipient.name}\n\n${message}`,
      html: emailShell(`<h1 style="margin:0;color:#03004b;font-size:24px">${htmlEscape(title)}</h1><p style="margin:20px 0 0;font-size:15px;line-height:2.2">سلام ${htmlEscape(recipient.name)}،<br>${htmlEscape(message)}</p>`),
    }));
  }
  if (recipient.notificationSmsEnabled) deliveries.push(sendConfiguredChannel(process.env.SMS_NOTIFICATION_URL, process.env.SMS_NOTIFICATION_TOKEN, recipient.phone, message, "SMS"));
  if (recipient.notificationBaleEnabled) deliveries.push(sendConfiguredChannel(process.env.BALE_NOTIFICATION_URL, process.env.BALE_NOTIFICATION_TOKEN, recipient.balePhone || recipient.phone, message, "BALE"));

  const results = await Promise.allSettled(deliveries);
  results.forEach((result) => { if (result.status === "rejected") console.error("Registration notification delivery failed:", result.reason); });
}
