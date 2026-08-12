export type BaleGroupEventType = "payment_paid" | "payment_duplicate" | "release";

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
  | { type: "release"; payload: ReleaseGroupPayload };

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
  baleGroupEvent: { upsert: (args: BaleGroupEventUpsert) => Promise<unknown> };
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
