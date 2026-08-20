import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import {
  applyDiscountToAmount,
  resolveDiscountFields,
} from "../lib/course-application-discount";
import { PATCH as handleDiscountPATCH } from "../app/api/course-applications/[id]/discount/route";

function makeRequest(token: string, body: unknown) {
  return new NextRequest("http://localhost/api/course-applications/x/discount", {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function tokenFor(userId: string) {
  // Return a fake token; the route under test verifies via the injected db, not the token.
  return `token-${userId}`;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    verify: () => ({ id: "user-1" }),
    db: {
      courseApplication: {
        findUnique: async ({ include }: { include: { course: unknown; paymentOrder: unknown } }) => ({
          id: "app-1",
          status: "pending",
          userId: "user-1",
          courseId: "course-1",
          course: { price: 100000 },
          paymentOrder: null,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "app-1",
          status: "pending",
          ...data,
        }),
      },
    },
    findDiscount: async (identifier: string, _allowCode?: boolean) =>
      identifier === "CODE10"
        ? { code: "CODE10", label: "گروه ویژه", percent: 10 }
        : null,
    applyDiscountToAmount,
    resolveDiscountFields,
    ...overrides,
  };
}

test("applyDiscountToAmount computes discounted amount", () => {
  assert.equal(applyDiscountToAmount(100000, 10), 90000);
  assert.equal(applyDiscountToAmount(100000, 0), 100000);
  assert.equal(applyDiscountToAmount(100000, 100), 0);
  assert.equal(applyDiscountToAmount(100000, -5), 100000);
});

test("resolveDiscountFields returns cleared fields for null discount", () => {
  assert.deepEqual(resolveDiscountFields(null), {
    discountCode: null,
    discountLabel: null,
    discountPercent: 0,
  });
});

test("resolveDiscountFields returns discount fields for a found discount", () => {
  assert.deepEqual(
    resolveDiscountFields({ code: "CODE10", label: "گروه ویژه", percent: 10 }),
    { discountCode: "CODE10", discountLabel: "گروه ویژه", discountPercent: 10 },
  );
});

test("discount PATCH applies a valid discount and recomputes amount", async () => {
  const deps = makeDeps();
  const res = await handleDiscountPATCH(makeRequest(tokenFor("user-1"), { discountCode: "CODE10" }), {
    params: { id: "app-1" },
  } as never, deps as never);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.finalAmountTomans, 90000);
  assert.equal(data.application.discountCode, "CODE10");
  assert.equal(data.application.discountPercent, 10);
});

test("discount PATCH clears discount when empty code is sent", async () => {
  const deps = makeDeps();
  const res = await handleDiscountPATCH(makeRequest(tokenFor("user-1"), { discountCode: "" }), {
    params: { id: "app-1" },
  } as never, deps as never);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.finalAmountTomans, 100000);
  assert.equal(data.application.discountCode, null);
  assert.equal(data.application.discountPercent, 0);
});

test("discount PATCH rejects an invalid discount code", async () => {
  const deps = makeDeps();
  const res = await handleDiscountPATCH(makeRequest(tokenFor("user-1"), { discountCode: "NOPE" }), {
    params: { id: "app-1" },
  } as never, deps as never);
  assert.equal(res.status, 400);
});

test("discount PATCH returns 404 when the application does not belong to the user", async () => {
  const deps = makeDeps({
    db: {
      courseApplication: {
        findUnique: async () => ({
          id: "app-1",
          status: "pending",
          userId: "other-user",
          courseId: "course-1",
          course: { price: 100000 },
          paymentOrder: null,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
      },
    },
  });
  const res = await handleDiscountPATCH(makeRequest(tokenFor("user-1"), { discountCode: "CODE10" }), {
    params: { id: "app-1" },
  } as never, deps as never);
  assert.equal(res.status, 404);
});

test("discount PATCH rejects when status is not editable", async () => {
  const deps = makeDeps({
    db: {
      courseApplication: {
        findUnique: async () => ({
          id: "app-1",
          status: "approved",
          userId: "user-1",
          courseId: "course-1",
          course: { price: 100000 },
          paymentOrder: null,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
      },
    },
  });
  const res = await handleDiscountPATCH(makeRequest(tokenFor("user-1"), { discountCode: "CODE10" }), {
    params: { id: "app-1" },
  } as never, deps as never);
  assert.equal(res.status, 400);
});
