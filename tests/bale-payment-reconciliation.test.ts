import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getAdminPayments } from "../app/api/admin/payments/route";
import { POST } from "../app/api/admin/payments/[id]/reconcile-bale/route";
import {
  isBaleReconciliationEligible,
  selectBaleReconciliationAttempt,
} from "../lib/bale-payment-reconciliation";

type Attempt = {
  id: string;
  orderId: string;
  sequence: number;
  method: string;
  status: string;
  amountTomans: number;
  amountRials: number;
  balePayload: string | null;
  balePaymentId: string | null;
  baleTrackingNumber: string | null;
  baleReceiptReference: string | null;
  baleVerificationStatus: string;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

type Order = {
  id: string;
  orderNumber: string;
  method: string;
  status: string;
  amountTomans: number;
  amountRials: number;
  balePayload: string | null;
  baleTransactionRef: string | null;
  activeAttemptId: string | null;
  paidAt: Date | null;
  applicationId: string;
  userId: string;
  courseId: string;
  payerBaleId?: string | null;
  baleChatId?: string | null;
  reviewerId?: string | null;
  reviewedAt?: Date | null;
};

function createState(input: {
  order?: Partial<Order>;
  attempt?: Partial<Attempt> | null;
  otherAttempts?: Attempt[];
} = {}) {
  const order: Order = {
    id: "order-1",
    orderNumber: "PAY-100",
    method: "bale_wallet",
    status: "pending",
    amountTomans: 400_000,
    amountRials: 4_000_000,
    balePayload: "payload-1",
    baleTransactionRef: null,
    activeAttemptId: "attempt-1",
    paidAt: null,
    applicationId: "application-1",
    userId: "user-1",
    courseId: "course-1",
    ...input.order,
  };
  const attempt = input.attempt === null ? null : {
    id: "attempt-1",
    orderId: order.id,
    sequence: 1,
    method: "bale_wallet",
    status: "pending",
    amountTomans: order.amountTomans,
    amountRials: order.amountRials,
    balePayload: order.balePayload,
    balePaymentId: null,
    baleTrackingNumber: null,
    baleReceiptReference: null,
    baleVerificationStatus: "unverified",
    paidAt: null,
    expiresAt: new Date("2026-08-10T12:15:00.000Z"),
    createdAt: new Date("2026-08-10T12:00:00.000Z"),
    ...input.attempt,
  } satisfies Attempt;
  const state = {
    orders: [order],
    attempts: [...(attempt ? [attempt] : []), ...(input.otherAttempts || [])],
    applicationStatus: "pending_payment",
    enrollments: 0,
    groupEvents: new Map<string, unknown>(),
  };

  function database(target: typeof state) {
    const orderWithAttempts = (found: Order) => ({
      ...found,
      attempts: target.attempts
        .filter((item) => item.orderId === found.id)
        .sort((left, right) => right.sequence - left.sequence),
    });
    return {
      paymentOrder: {
        findUnique: async ({ where }: any) => {
          const found = target.orders.find((item) => item.id === where.id);
          return found ? orderWithAttempts(found) : null;
        },
        update: async ({ where, data }: any) => {
          const found = target.orders.find((item) => item.id === where.id);
          if (!found) throw Object.assign(new Error("Record not found"), { code: "P2025" });
          Object.assign(found, data);
          return found;
        },
      },
      paymentAttempt: {
        findUnique: async ({ where, include }: any) => {
          const found = target.attempts.find((item) => item.id === where.id || item.balePayload === where.balePayload);
          if (!found) return null;
          const foundOrder = target.orders.find((item) => item.id === found.orderId);
          return include?.order ? { ...found, order: foundOrder } : found;
        },
        findMany: async ({ where }: any) => target.attempts.filter((item) =>
          where.OR.some((condition: any) =>
            (condition.balePaymentId && item.balePaymentId === condition.balePaymentId) ||
            (condition.baleTrackingNumber && item.baleTrackingNumber === condition.baleTrackingNumber),
          ),
        ),
        create: async ({ data }: any) => {
          const created: Attempt = {
            id: `attempt-${target.attempts.length + 1}`,
            balePaymentId: null,
            baleTrackingNumber: null,
            baleReceiptReference: null,
            baleVerificationStatus: "unverified",
            paidAt: null,
            expiresAt: null,
            createdAt: new Date("2026-08-11T10:00:00.000Z"),
            ...data,
          };
          target.attempts.push(created);
          return created;
        },
        update: async ({ where, data }: any) => {
          const found = target.attempts.find((item) => item.id === where.id);
          if (!found) throw Object.assign(new Error("Record not found"), { code: "P2025" });
          for (const key of ["balePaymentId", "baleTrackingNumber"] as const) {
            const value = data[key];
            if (value && target.attempts.some((item) => item.id !== found.id && item[key] === value)) {
              throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
            }
          }
          Object.assign(found, data);
          return found;
        },
        updateMany: async ({ where, data }: any) => {
          const found = target.attempts.find((item) =>
            (where.id === undefined || item.id === where.id) &&
            (where.orderId === undefined || item.orderId === where.orderId),
          );
          if (!found) return { count: 0 };
          Object.assign(found, data);
          return { count: 1 };
        },
      },
      courseApplication: {
        update: async () => { target.applicationStatus = "approved"; },
      },
      enrollment: {
        upsert: async () => { target.enrollments = 1; },
      },
      enrollmentGrant: { upsert: async () => undefined },
      baleGroupEvent: {
        upsert: async (args: any) => {
          if (!target.groupEvents.has(args.where.eventKey)) target.groupEvents.set(args.where.eventKey, args.create);
          return target.groupEvents.get(args.where.eventKey);
        },
      },
    };
  }

  const db = {
    ...database(state),
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const snapshot = structuredClone(state);
      const result = await callback(database(snapshot));
      state.orders = snapshot.orders;
      state.attempts = snapshot.attempts;
      state.applicationStatus = snapshot.applicationStatus;
      state.enrollments = snapshot.enrollments;
      state.groupEvents = snapshot.groupEvents;
      return result;
    },
  };
  return { state, db };
}

function reconciliationRequest(body: Record<string, unknown> = { trackingNumber: "tracking-123" }) {
  return new NextRequest("http://localhost/api/admin/payments/order-1/reconcile-bale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptReference: "receipt-default", confirmUnmatchedPayer: true, ...body }),
  });
}

const authorize = async () => ({ id: "admin-1" });

test("selects the same recovery attempt regardless of attempt ordering", () => {
  const attempts = [
    { id: "paid-old", sequence: 1, method: "bale_wallet", status: "paid", balePaymentId: "payment-old" },
    { id: "active", sequence: 2, method: "bale_wallet", status: "pending", balePaymentId: null, baleTrackingNumber: null },
    { id: "newer", sequence: 3, method: "bale_wallet", status: "expired", baleTrackingNumber: "tracking-newer" },
  ];

  assert.equal(selectBaleReconciliationAttempt({ activeAttemptId: "active", attempts })?.id, "newer");
  assert.equal(selectBaleReconciliationAttempt({ activeAttemptId: "active", attempts: [...attempts].reverse() })?.id, "newer");
  assert.equal(selectBaleReconciliationAttempt({ activeAttemptId: "paid-old", attempts })?.id, "newer");
});

test("prefers unresolved received evidence over a newer empty active attempt", () => {
  const attempts = [
    { id: "received-old", sequence: 1, method: "bale_wallet", status: "pending", balePaymentId: "payment-1", baleTrackingNumber: "tracking-1" },
    { id: "active-empty", sequence: 2, method: "bale_wallet", status: "pending", balePaymentId: null, baleTrackingNumber: null },
  ];

  assert.equal(selectBaleReconciliationAttempt({ activeAttemptId: "active-empty", attempts })?.id, "received-old");
  assert.equal(selectBaleReconciliationAttempt({ activeAttemptId: "active-empty", attempts }, "active-empty")?.id, "active-empty");
});

test("rejects reconciliation without payment-admin authorization", async () => {
  const request = new NextRequest("http://localhost/api/admin/payments/order-1/reconcile-bale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingNumber: "tracking-123" }),
  });

  const response = await POST(request, { params: { id: "order-1" } }, { authorize: async () => null });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "دسترسی غیرمجاز" });
});

test("rejects an unknown order without querying Bale", async () => {
  const { db } = createState();
  let inquiries = 0;
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "missing" } },
    { db, authorize, inquire: async () => { inquiries += 1; } } as any,
  );

  assert.equal(response.status, 404);
  assert.equal(inquiries, 0);
});

test("rejects an unknown Bale transaction result", async () => {
  const { state, db } = createState();
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: null }) } as any,
  );

  assert.equal(response.status, 422);
  assert.equal(state.orders[0].status, "pending");
});

test("rejects a transaction unless its documented status is exactly paid", async () => {
  const { state, db } = createState();
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-123", status: "completed", amount: 4_000_000 } }) } as any,
  );

  assert.equal(response.status, 422);
  assert.equal(state.orders[0].status, "pending");
  assert.equal(state.attempts[0].balePaymentId, null);
});

test("rejects a paid transaction whose rial amount does not exactly match", async () => {
  const { state, db } = createState();
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-123", status: "paid", amount: 3_999_999 } }) } as any,
  );

  assert.equal(response.status, 422);
  assert.equal(state.orders[0].status, "pending");
});

test("validates the exact attempt amount rather than only the order summary", async () => {
  const { state, db } = createState({ attempt: { amountTomans: 300_000, amountRials: 3_000_000 } });
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-123", status: "paid", amount: 4_000_000 } }) } as any,
  );

  assert.equal(response.status, 422);
  assert.equal(state.orders[0].status, "pending");
});

test("rejects a mismatched transaction ID when a unique Bale payment ID is stored", async () => {
  const { state, db } = createState({
    attempt: { balePaymentId: "payment-stored", baleTrackingNumber: "tracking-123" },
  });
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-other", status: "paid", amount: 4_000_000 } }) } as any,
  );

  assert.equal(response.status, 409);
  assert.equal(state.attempts[0].balePaymentId, "payment-stored");
});

test("queries the stored unique payment ID before falling back to tracking", async () => {
  const { state, db } = createState({
    attempt: { balePaymentId: "payment-stored", baleTrackingNumber: "tracking-stored" },
  });
  const references: string[] = [];
  const response = await POST(
    reconciliationRequest({ receiptReference: " 8260047130 " }),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      now: () => new Date("2026-08-11T10:00:00.000Z"),
      inquire: async (reference: string) => {
        references.push(reference);
        if (reference === "payment-stored") throw new Error("BALE_INQUIRETRANSACTION_FAILED: unknown");
        return { result: { id: "payment-stored", status: "paid", amount: 4_000_000 } };
      },
    } as any,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(references, ["payment-stored", "tracking-stored"]);
  assert.equal(state.orders[0].status, "paid");
  assert.equal(state.attempts[0].baleVerificationStatus, "inquiry_paid");
  assert.equal(state.attempts[0].baleReceiptReference, "8260047130");
  assert.equal(state.attempts[0].paidAt?.toISOString(), "2026-08-11T10:00:00.000Z");
  assert.equal(state.applicationStatus, "approved");
  assert.equal(state.enrollments, 1);
});

test("continues to tracking fallback when payment ID inquiry has no transaction result", async () => {
  const { state, db } = createState({
    attempt: { balePaymentId: "payment-stored", baleTrackingNumber: "tracking-stored" },
  });
  const references: string[] = [];
  const response = await POST(
    reconciliationRequest({}),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      inquire: async (reference: string) => {
        references.push(reference);
        return reference === "payment-stored"
          ? { result: null }
          : { result: { id: "payment-stored", status: "paid", amount: 4_000_000 } };
      },
    } as any,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(references, ["payment-stored", "tracking-stored"]);
  assert.equal(state.attempts[0].baleTrackingNumber, "tracking-stored");
});

test("ignores arbitrary supplied tracking when stored payment ID inquiry succeeds", async () => {
  const { state, db } = createState({ attempt: { balePaymentId: "payment-stored" } });
  const references: string[] = [];
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-unverified", receiptReference: "receipt-manual" }),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      inquire: async (reference: string) => {
        references.push(reference);
        return { result: { id: "payment-stored", status: "paid", amount: 4_000_000 } };
      },
    } as any,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(references, ["payment-stored"]);
  assert.equal(state.attempts[0].baleTrackingNumber, null);
  assert.equal(state.orders[0].baleTransactionRef, null);
  assert.equal(state.attempts[0].baleReceiptReference, "receipt-manual");
});

test("persists supplied tracking only after that exact reference verifies the transaction", async () => {
  const { state, db } = createState();
  const references: string[] = [];
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-verified" }),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      inquire: async (reference: string) => {
        references.push(reference);
        return { result: { id: "payment-returned", status: "paid", amount: 4_000_000 } };
      },
    } as any,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(references, ["tracking-verified"]);
  assert.equal(state.attempts[0].baleTrackingNumber, "tracking-verified");
  assert.equal(state.orders[0].baleTransactionRef, "tracking-verified");
});

test("API reconciliation uses the shared selector instead of older paid identifiers", async () => {
  const olderPaid: Attempt = {
    id: "attempt-paid-old",
    orderId: "order-1",
    sequence: 1,
    method: "bale_wallet",
    status: "paid",
    amountTomans: 400_000,
    amountRials: 4_000_000,
    balePayload: "payload-old",
    balePaymentId: "payment-old",
    baleTrackingNumber: "tracking-old",
    baleReceiptReference: null,
    baleVerificationStatus: "successful_payment",
    paidAt: new Date("2026-08-10T09:00:00.000Z"),
    expiresAt: null,
    createdAt: new Date("2026-08-10T08:00:00.000Z"),
  };
  const { state, db } = createState({
    order: { baleTransactionRef: "tracking-old" },
    attempt: { sequence: 2 },
    otherAttempts: [olderPaid],
  });
  const references: string[] = [];
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-active" }),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      inquire: async (reference: string) => {
        references.push(reference);
        return { result: { id: "payment-active", status: "paid", amount: 4_000_000 } };
      },
    } as any,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(references, ["tracking-active"]);
  assert.equal(state.attempts.find((attempt) => attempt.id === "attempt-1")?.status, "paid");
  assert.equal(state.attempts.find((attempt) => attempt.id === "attempt-paid-old")?.balePaymentId, "payment-old");
});

test("API safely honors an explicit unresolved attempt selection", async () => {
  const olderEvidence: Attempt = {
    id: "attempt-evidence-old",
    orderId: "order-1",
    sequence: 1,
    method: "bale_wallet",
    status: "expired",
    amountTomans: 400_000,
    amountRials: 4_000_000,
    balePayload: "payload-evidence-old",
    balePaymentId: "payment-evidence-old",
    baleTrackingNumber: "tracking-evidence-old",
    baleReceiptReference: null,
    baleVerificationStatus: "received",
    paidAt: null,
    expiresAt: new Date("2026-08-10T09:15:00.000Z"),
    createdAt: new Date("2026-08-10T09:00:00.000Z"),
  };
  const { state, db } = createState({ attempt: { sequence: 2 }, otherAttempts: [olderEvidence] });
  const references: string[] = [];
  const response = await POST(
    reconciliationRequest({ attemptId: "attempt-1", trackingNumber: "tracking-active" }),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      inquire: async (reference: string) => {
        references.push(reference);
        return { result: { id: "payment-active", userID: "99", status: "paid", amount: 4_000_000 } };
      },
    } as any,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(references, ["tracking-active"]);
  assert.equal(state.attempts.find((attempt) => attempt.id === "attempt-1")?.status, "paid");
  assert.equal(state.attempts.find((attempt) => attempt.id === olderEvidence.id)?.status, "expired");
});

test("recovers a matching paid transaction by tracking and stores its returned unique payment ID", async () => {
  const { state, db } = createState();
  const response = await POST(
    reconciliationRequest({ trackingNumber: " tracking-123 ", receiptReference: "receipt-9" }),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      now: () => new Date("2026-08-11T10:00:00.000Z"),
      inquire: async () => ({ result: { id: "payment-123", status: "paid", amount: 4_000_000 } }),
    } as any,
  );

  assert.equal(response.status, 200);
  assert.equal(state.attempts[0].balePaymentId, "payment-123");
  assert.equal(state.attempts[0].baleTrackingNumber, "tracking-123");
  assert.equal(state.orders[0].baleTransactionRef, "tracking-123");
});

test("accepts inquiry payer userID matching stored Bale payer evidence", async () => {
  const { state, db } = createState({ order: { payerBaleId: "42" } });
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-123", receiptReference: "", confirmUnmatchedPayer: false }),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-123", userID: 42, status: "paid", amount: 4_000_000 } }) } as any,
  );

  assert.equal(response.status, 200);
  assert.equal(state.orders[0].status, "paid");
});

test("rejects inquiry payer userID mismatching stored Bale payer evidence", async () => {
  const { state, db } = createState({ order: { baleChatId: "42" } });
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-123" }),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-123", userID: "99", status: "paid", amount: 4_000_000 } }) } as any,
  );

  assert.equal(response.status, 422);
  assert.equal(state.orders[0].status, "pending");
});

test("requires receipt and explicit ownership confirmation without payer evidence", async () => {
  const first = createState();
  const inquiry = async () => ({ result: { id: "payment-123", userID: "99", status: "paid", amount: 4_000_000 } });
  const rejected = await POST(
    reconciliationRequest({ trackingNumber: "tracking-123", receiptReference: "", confirmUnmatchedPayer: false }),
    { params: { id: "order-1" } },
    { db: first.db, authorize, inquire: inquiry } as any,
  );
  assert.equal(rejected.status, 422);

  const second = createState();
  const reviewedAt = new Date("2026-08-11T11:00:00.000Z");
  const accepted = await POST(
    reconciliationRequest({ trackingNumber: "tracking-123", receiptReference: "receipt-1", confirmUnmatchedPayer: true }),
    { params: { id: "order-1" } },
    { db: second.db, authorize, inquire: inquiry, now: () => reviewedAt } as any,
  );

  assert.equal(accepted.status, 200);
  assert.equal(second.state.orders[0].reviewerId, "admin-1");
  assert.equal(second.state.orders[0].reviewedAt?.toISOString(), reviewedAt.toISOString());
});

test("rejects reuse of a transaction already paid on another attempt", async () => {
  const otherAttempt: Attempt = {
    id: "attempt-other",
    orderId: "order-other",
    sequence: 1,
    method: "bale_wallet",
    status: "paid",
    amountTomans: 400_000,
    amountRials: 4_000_000,
    balePayload: "payload-other",
    balePaymentId: "payment-123",
    baleTrackingNumber: "tracking-123",
    baleReceiptReference: null,
    baleVerificationStatus: "successful_payment",
    paidAt: new Date("2026-08-10T10:00:00.000Z"),
    expiresAt: null,
    createdAt: new Date("2026-08-10T09:00:00.000Z"),
  };
  const { state, db } = createState({ otherAttempts: [otherAttempt] });
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => ({ result: { id: "payment-123", status: "paid", amount: 4_000_000 } }) } as any,
  );

  assert.equal(response.status, 409);
  assert.equal(state.orders[0].status, "pending");
  assert.equal(state.attempts[0].balePaymentId, null);
});

test("does not inquire or overwrite evidence on an already-paid order", async () => {
  const { state, db } = createState({
    order: { status: "paid", baleTransactionRef: "tracking-original" },
    attempt: {
      status: "paid",
      balePaymentId: "payment-original",
      baleTrackingNumber: "tracking-original",
      baleReceiptReference: "receipt-original",
      baleVerificationStatus: "successful_payment",
    },
  });
  let inquiries = 0;
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-other", receiptReference: "receipt-other" }),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => { inquiries += 1; } } as any,
  );

  assert.equal(response.status, 409);
  assert.equal(inquiries, 0);
  assert.equal(state.attempts[0].balePaymentId, "payment-original");
  assert.equal(state.attempts[0].baleReceiptReference, "receipt-original");
});

test("does not overwrite paid attempt evidence when its order summary is inconsistent", async () => {
  const { state, db } = createState({
    attempt: {
      status: "paid",
      balePaymentId: "payment-original",
      baleTrackingNumber: "tracking-original",
      baleReceiptReference: "receipt-original",
      baleVerificationStatus: "successful_payment",
    },
  });
  let inquiries = 0;
  const response = await POST(
    reconciliationRequest({ trackingNumber: "tracking-original", receiptReference: "receipt-other" }),
    { params: { id: "order-1" } },
    { db, authorize, inquire: async () => { inquiries += 1; } } as any,
  );

  assert.equal(response.status, 409);
  assert.equal(inquiries, 0);
  assert.equal(state.attempts[0].baleVerificationStatus, "successful_payment");
  assert.equal(state.attempts[0].baleReceiptReference, "receipt-original");
});

test("creates a Bale attempt for a recoverable legacy order before shared finalization", async () => {
  const { state, db } = createState({ order: { activeAttemptId: null }, attempt: null });
  const response = await POST(
    reconciliationRequest(),
    { params: { id: "order-1" } },
    {
      db,
      authorize,
      inquire: async () => ({ result: { id: "payment-legacy", status: "paid", amount: 4_000_000 } }),
    } as any,
  );

  assert.equal(response.status, 200);
  assert.equal(state.attempts.length, 1);
  assert.equal(state.attempts[0].status, "paid");
  assert.equal(state.orders[0].activeAttemptId, state.attempts[0].id);
});

test("admin payments API returns attempt history in ascending sequence order", async () => {
  let findManyArgs: any;
  const db = {
    paymentOrder: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [{
          id: "order-1",
          balePayload: "order-secret-payload",
          payerCardEncrypted: null,
          attempts: [
            { id: "attempt-1", sequence: 1, balePayload: "attempt-secret-1" },
            { id: "attempt-2", sequence: 2, balePayload: "attempt-secret-2" },
          ],
        }];
      },
    },
    paymentSettings: { findUnique: async () => null },
  };
  const request = new NextRequest("http://localhost/api/admin/payments");

  const response = await (getAdminPayments as any)(request, {}, { db, authorize });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(findManyArgs.include.attempts.orderBy.sequence, "asc");
  assert.equal(findManyArgs.include.attempts.select.balePayload, undefined);
  assert.deepEqual(payload.orders[0].attempts.map((attempt: any) => attempt.sequence), [1, 2]);
  assert.equal(payload.orders[0].balePayload, undefined);
  assert.equal(payload.orders[0].attempts[0].balePayload, undefined);
});

test("offers admin recovery only for unpaid orders with Bale evidence", () => {
  const recoverable = {
    status: "expired",
    method: "card_to_card",
    balePayload: null,
    attempts: [{ method: "bale_wallet", balePayload: "payload-old" }],
  };
  assert.equal(isBaleReconciliationEligible(recoverable as any), true);
  assert.equal(isBaleReconciliationEligible({ ...recoverable, status: "paid" } as any), false);
  assert.equal(isBaleReconciliationEligible({ ...recoverable, attempts: [] } as any), false);
  assert.equal(isBaleReconciliationEligible({ ...recoverable, method: "bale_wallet", attempts: [] } as any), true);
  assert.equal(isBaleReconciliationEligible({ ...recoverable, attempts: [{ ...recoverable.attempts[0], status: "paid" }] } as any), false);
});
