export type BaleGroupEventType = "payment_paid" | "payment_duplicate" | "release" | "support_ticket" |
  "support_user_message" | "course_application" | "payment_receipt" | "profile_review" | "avatar_review";

export type PaymentGroupPayload = {
  studentName: string;
  courseTitle: string;
  amountTomans: number;
  method: string;
  orderNumber: string;
  paidAt: string;
};

export type ReleaseGroupPayload = { version: string; title: string; publishedAt: string; capabilities: string[] };
type GroupEvent =
  | { type: "payment_paid" | "payment_duplicate"; payload: PaymentGroupPayload }
  | { type: "release"; payload: ReleaseGroupPayload }
  | { type: "support_ticket"; payload: SupportTicketPayload }
  | { type: "support_user_message"; payload: SupportUserMessagePayload }
  | { type: "course_application"; payload: CourseApplicationPayload }
  | { type: "payment_receipt"; payload: PaymentReceiptPayload }
  | { type: "profile_review"; payload: ProfileReviewPayload }
  | { type: "avatar_review"; payload: AvatarReviewPayload };

export type BaleGroupActionName = "support_ticket" | "course_application" | "payment_order" | "user";
type BaseRequestPayload = { displayName: string; submittedAt: string; userId: string; actions: readonly BaleGroupActionName[] };
export type SupportTicketPayload = BaseRequestPayload & { subject: string; ticketId: string };
export type SupportUserMessagePayload = SupportTicketPayload & { messageId: string };
export type CourseApplicationPayload = BaseRequestPayload & { applicationId: string; courseTitle: string; reviewState: "pending" };
export type PaymentReceiptPayload = BaseRequestPayload & { orderId: string; orderNumber: string; courseTitle: string; amountTomans?: number };
export type ProfileReviewPayload = BaseRequestPayload;
export type AvatarReviewPayload = BaseRequestPayload & { submissionId: string };

export type BaleGroupAction =
  | { action: "support_ticket"; ticketId: string }
  | { action: "course_application"; applicationId: string }
  | { action: "payment_order"; orderId: string }
  | { action: "user"; userId: string };

type PaymentOrderSnapshot = {
  id: string;
  orderNumber: string;
  amountTomans: number;
  method: string;
  user?: { name?: string | null } | null;
  course?: { title?: string | null } | null;
  application?: { fullName?: string | null } | null;
};

type BaleGroupEventUpsert = {
  where: { eventKey: string };
  update: Record<string, never>;
  create: { eventKey: string; type: "payment_paid" | "payment_duplicate"; payload: string };
};

export type BaleGroupEventTransaction = {
  baleGroupEvent: { upsert: (args: BaleGroupEventUpsert | { where: { eventKey: string }; update: Record<string, never>; create: { eventKey: string; type: BaleGroupEventType; payload: string } }) => Promise<unknown> };
};

const methodLabels: Record<string, string> = {
  bale_wallet: "کیف پول بله",
  card_to_card: "کارت‌به‌کارت",
  manual: "پرداخت دستی",
};

export const paymentPaidEventKey = (orderId: string) => `payment-paid:${orderId}`;
export const paymentDuplicateEventKey = (attemptId: string) => `payment-duplicate:${attemptId}`;
export const releaseEventKey = (releaseId: string) => `release:${releaseId}`;

export function retryAt(now: Date, attempts: number) {
  return new Date(now.getTime() + Math.max(1, attempts) * 60_000);
}

export function retryBaleGroupEvent(now: Date, attempts: number) {
  return attempts >= 10
    ? { status: "needs_review" as const, nextAttemptAt: null }
    : { status: "retryable" as const, nextAttemptAt: retryAt(now, attempts) };
}

export function canClaimBaleGroupEvent(
  event: {
    status: string;
    attempts: number;
    nextAttemptAt: Date;
    claimedAt: Date | null;
    sendStartedAt: Date | null;
  },
  now: Date,
  staleBefore: Date,
) {
  if (event.attempts >= 10) return false;
  if (["pending", "retryable"].includes(event.status)) return event.nextAttemptAt <= now;
  return event.status === "processing" && event.sendStartedAt === null &&
    event.claimedAt !== null && event.claimedAt < staleBefore;
}

function formatPersianDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("day")} ${part("month")} ${part("year")}، ${part("hour")}:${part("minute")}`;
}

export function formatBaleGroupEvent(event: GroupEvent) {
  if (event.type === "release") {
    const payload = event.payload;
    return [
      `🚀 ${payload.title}`,
      `نسخه: ${payload.version}`,
      `تاریخ انتشار: ${formatPersianDateTime(payload.publishedAt)}`,
      "",
      ...payload.capabilities.map((title) => `• ${title}`),
    ].join("\n");
  }
  if (event.type === "support_ticket" || event.type === "support_user_message") {
    return [event.type === "support_ticket" ? "🎫 تیکت پشتیبانی جدید" : "💬 پاسخ جدید هنرجو", "دسته: پشتیبانی",
      `نام: ${event.payload.displayName}`, `موضوع: ${event.payload.subject}`, `زمان: ${formatPersianDateTime(event.payload.submittedAt)}`].join("\n");
  }
  if (event.type === "course_application") {
    return ["📝 درخواست ثبت‌نام دوره", "دسته: ثبت‌نام", `نام: ${event.payload.displayName}`,
      `دوره: ${event.payload.courseTitle}`, "وضعیت: در انتظار بررسی", `زمان: ${formatPersianDateTime(event.payload.submittedAt)}`].join("\n");
  }
  if (event.type === "payment_receipt") {
    return ["🧾 رسید پرداخت جدید", "دسته: پرداخت", `نام: ${event.payload.displayName}`,
      `دوره: ${event.payload.courseTitle}`, ...(event.payload.amountTomans ? [`مبلغ: ${event.payload.amountTomans.toLocaleString("fa-IR")} تومان`] : []),
      `شماره سفارش: ${event.payload.orderNumber}`, `زمان: ${formatPersianDateTime(event.payload.submittedAt)}`].join("\n");
  }
  if (event.type === "profile_review" || event.type === "avatar_review") {
    return [event.type === "profile_review" ? "👤 بازبینی پروفایل" : "🖼️ بازبینی تصویر پروفایل",
      `دسته: ${event.type === "profile_review" ? "پروفایل" : "تصویر پروفایل"}`, `نام: ${event.payload.displayName}`,
      `زمان: ${formatPersianDateTime(event.payload.submittedAt)}`].join("\n");
  }
  const payload = event.payload;
  const heading = event.type === "payment_duplicate" ? "⚠️ پرداخت تکراری؛ نیازمند پیگیری" : "✅ پرداخت موفق";
  return [
    heading,
    `هنرجو: ${payload.studentName}`,
    `دوره: ${payload.courseTitle}`,
    `مبلغ: ${payload.amountTomans.toLocaleString("fa-IR")} تومان`,
    `روش پرداخت: ${methodLabels[payload.method] || payload.method}`,
    `شماره سفارش: ${payload.orderNumber}`,
    `تاریخ پرداخت: ${formatPersianDateTime(payload.paidAt)}`,
  ].join("\n");
}

export function baleGroupEventActions(event: GroupEvent): BaleGroupAction[] {
  const payload = event.payload as BaseRequestPayload;
  if (!("actions" in payload)) return [];
  return payload.actions.map((action) => {
    if (action === "support_ticket" && "ticketId" in event.payload) return { action, ticketId: event.payload.ticketId };
    if (action === "course_application" && "applicationId" in event.payload) return { action, applicationId: event.payload.applicationId };
    if (action === "payment_order" && "orderId" in event.payload) return { action, orderId: event.payload.orderId };
    return { action: "user", userId: payload.userId };
  });
}

async function queueRequestEvent(tx: BaleGroupEventTransaction, eventKey: string, type: BaleGroupEventType, payload: object) {
  return tx.baleGroupEvent.upsert({ where: { eventKey }, update: {}, create: { eventKey, type, payload: JSON.stringify(payload) } });
}

export function queueSupportTicketEvent(tx: BaleGroupEventTransaction, ticket: { id: string; subject: string; userId: string; user: { name?: string | null } }, submittedAt: Date) {
  return queueRequestEvent(tx, `support-ticket:${ticket.id}`, "support_ticket", { displayName: ticket.user.name || "نامشخص", subject: ticket.subject, submittedAt: submittedAt.toISOString(), ticketId: ticket.id, userId: ticket.userId, actions: ["support_ticket", "user"] });
}
export function queueSupportUserMessageEvent(tx: BaleGroupEventTransaction, message: { id: string; ticketId: string; authorId: string; ticket: { subject: string; userId: string }; author: { name?: string | null; role: string } }, submittedAt: Date) {
  if (message.author.role !== "user" || message.authorId !== message.ticket.userId) return Promise.resolve(null);
  return queueRequestEvent(tx, `support-user-message:${message.id}`, "support_user_message", { displayName: message.author.name || "نامشخص", subject: message.ticket.subject, submittedAt: submittedAt.toISOString(), ticketId: message.ticketId, messageId: message.id, userId: message.ticket.userId, actions: ["support_ticket", "user"] });
}
export function queueCourseApplicationEvent(tx: BaleGroupEventTransaction, application: { id: string; fullName: string; userId: string; course: { title?: string | null } }, submittedAt: Date) {
  return queueRequestEvent(tx, `course-application:${application.id}`, "course_application", { displayName: application.fullName, courseTitle: application.course.title || "نامشخص", reviewState: "pending", submittedAt: submittedAt.toISOString(), applicationId: application.id, userId: application.userId, actions: ["course_application", "user"] });
}
export function queuePaymentReceiptEvent(tx: BaleGroupEventTransaction, order: { id: string; orderNumber: string; amountTomans: number; userId: string; user: { name?: string | null }; course: { title?: string | null } }, revision: number, submittedAt: Date) {
  return queueRequestEvent(tx, `payment-receipt:${order.id}:${revision}`, "payment_receipt", { displayName: order.user.name || "نامشخص", courseTitle: order.course.title || "نامشخص", orderNumber: order.orderNumber, amountTomans: order.amountTomans, submittedAt: submittedAt.toISOString(), orderId: order.id, userId: order.userId, actions: ["payment_order", "user"] });
}
export function queueProfileReviewEvent(tx: BaleGroupEventTransaction, user: { id: string; name?: string | null }, revision: number, submittedAt: Date) {
  return queueRequestEvent(tx, `profile-review:${user.id}:${revision}`, "profile_review", { displayName: user.name || "نامشخص", submittedAt: submittedAt.toISOString(), userId: user.id, actions: ["user"] });
}
export function queueAvatarReviewEvent(tx: BaleGroupEventTransaction, submission: { id: string; userId: string; user: { name?: string | null } }, submittedAt: Date) {
  return queueRequestEvent(tx, `avatar-review:${submission.id}`, "avatar_review", { displayName: submission.user.name || "نامشخص", submittedAt: submittedAt.toISOString(), submissionId: submission.id, userId: submission.userId, actions: ["user"] });
}

async function queuePaymentEvent(
  tx: BaleGroupEventTransaction,
  type: "payment_paid" | "payment_duplicate",
  subjectId: string,
  payload: PaymentGroupPayload,
) {
  const eventKey = type === "payment_paid" ? paymentPaidEventKey(subjectId) : paymentDuplicateEventKey(subjectId);
  return tx.baleGroupEvent.upsert({
    where: { eventKey },
    update: {},
    create: { eventKey, type, payload: JSON.stringify(payload) },
  });
}

function paymentPayload(order: PaymentOrderSnapshot, paidAt: Date): PaymentGroupPayload {
  return {
    studentName: order.user?.name || order.application?.fullName || "نامشخص",
    courseTitle: order.course?.title || "نامشخص",
    amountTomans: order.amountTomans,
    method: order.method,
    orderNumber: order.orderNumber,
    paidAt: paidAt.toISOString(),
  };
}

export function queuePaidPaymentEvent(tx: BaleGroupEventTransaction, order: PaymentOrderSnapshot, paidAt: Date) {
  return queuePaymentEvent(tx, "payment_paid", order.id, paymentPayload(order, paidAt));
}

export function queueDuplicatePaymentEvent(
  tx: BaleGroupEventTransaction,
  order: PaymentOrderSnapshot,
  attemptId: string,
  paidAt: Date,
) {
  return queuePaymentEvent(tx, "payment_duplicate", attemptId, paymentPayload(order, paidAt));
}
