import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getAdminPayments } from "../app/api/admin/payments/route";
import { POST } from "../app/api/admin/payments/[id]/reconcile-bale/route";
import PaymentsAdminPage from "../app/admin/payments/page";

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
      },
      courseApplication: {
        update: async () => { target.applicationStatus = "approved"; },
      },
      enrollment: {
        upsert: async () => { target.enrollments = 1; },
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
      return result;
    },
  };
  return { state, db };
}

function reconciliationRequest(body: Record<string, unknown> = { trackingNumber: "tracking-123" }) {
  return new NextRequest("http://localhost/api/admin/payments/order-1/reconcile-bale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authorize = async () => ({ id: "admin-1" });

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
          payerCardEncrypted: null,
          attempts: [
            { id: "attempt-1", sequence: 1 },
            { id: "attempt-2", sequence: 2 },
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
  assert.deepEqual(findManyArgs.include.attempts, { orderBy: { sequence: "asc" } });
  assert.deepEqual(payload.orders[0].attempts.map((attempt: any) => attempt.sequence), [1, 2]);
});

test("offers admin recovery only for unpaid orders with Bale evidence", () => {
  const recoverable = {
    status: "expired",
    method: "card_to_card",
    balePayload: null,
    attempts: [{ method: "bale_wallet", balePayload: "payload-old" }],
  };
  const eligible = PaymentsAdminPage.isBaleReconciliationEligible;
  assert.equal(eligible(recoverable as any), true);
  assert.equal(eligible({ ...recoverable, status: "paid" } as any), false);
  assert.equal(eligible({ ...recoverable, attempts: [] } as any), false);
  assert.equal(eligible({ ...recoverable, method: "bale_wallet", balePayload: "payload-legacy", attempts: [] } as any), true);
  assert.equal(eligible({ ...recoverable, attempts: [{ ...recoverable.attempts[0], status: "paid" }] } as any), false);
});
