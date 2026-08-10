# Bale Payment Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably finalize Bale wallet payments, enforce a 15-minute attempt window, return expired users to method selection, expose Bale identifiers in admin, and recover the verified Ali Jalali payment.

**Architecture:** Treat `PaymentAttempt` as the durable owner of each provider interaction and `PaymentOrder` as the aggregate. Process documented `SuccessfulPayment` idempotently through one shared finalizer; use inquiry only for reconciliation. Checkout uses server deadlines and polling, while admin displays and reconciles attempt history.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5 with SQLite, React 18, Node test runner through `tsx --test`, Bale Bot API.

## Global Constraints

- Bale payment window is exactly 15 minutes from server-side attempt creation.
- A documented `SuccessfulPayment` does not depend on synchronous inquiry.
- Never lose a late successful payment; resolve it through attempt payload history.
- Printed receipt reference is optional/manual because Bale Bot API does not expose it.
- Preserve unrelated dirty-worktree changes and stage only task files.
- Save dated complete documentation snapshots for every supplied external API.

---

### Task 1: Payment Domain And Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/bale-payment-domain.ts`
- Create: `tests/bale-payment-domain.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `BALE_PAYMENT_WINDOW_MS`, `newBaleExpiry(now)`, `isExpired(expiresAt, now)`, and Bale payload validation functions.
- Produces: attempt fields for expiry, payment ID, tracking number, receipt reference, verification, invoice/pre-checkout/paid timestamps.

- [ ] Write tests asserting a 15-minute deadline, boundary expiration, IRR/amount/payload validation, and documented paid status.
- [ ] Run `npx tsx --test tests/bale-payment-domain.test.ts` and verify failure because the domain module does not exist.
- [ ] Add the minimal pure domain module and Prisma fields; retain `baleTransactionRef` as the order-level tracking summary for compatibility.
- [ ] Add `test` script as `tsx --test tests/*.test.ts`.
- [ ] Run `npm test` and `npx prisma validate`.
- [ ] Commit only Task 1 files with `feat: model reliable Bale payment attempts`.

### Task 2: Idempotent Bale Finalization And Webhook

**Files:**
- Create: `lib/bale-payment-finalization.ts`
- Modify: `app/api/bale/webhook/[secret]/route.ts`
- Modify: `lib/bale-payment.ts`
- Create: `tests/bale-payment-webhook.test.ts`

**Interfaces:**
- Consumes: Task 1 domain functions and attempt fields.
- Produces: `finalizeBalePayment(tx, input)` returning `paid`, `already_paid`, or `paid_duplicate`.

- [ ] Write failing tests for success without inquiry, duplicate webhook idempotency, old-attempt success, duplicate paid attempt, and amount/currency rejection.
- [ ] Run the focused test and verify failure.
- [ ] Implement shared atomic finalization and change webhook lookup from order payload to attempt payload.
- [ ] Store pre-checkout ID before answering and store both successful-payment IDs before finalization.
- [ ] Add a sub-10-second timeout to Bale API calls and preserve provider error details without secrets.
- [ ] Run focused tests and `npm test`.
- [ ] Commit with `fix: finalize Bale successful payments reliably`.

### Task 3: Expiration, Restart, And Polling APIs

**Files:**
- Modify: `app/api/payments/route.ts`
- Modify: `app/api/payments/[id]/change-method/route.ts`
- Create: `app/api/payments/[id]/expire/route.ts`
- Create: `tests/bale-payment-expiration.test.ts`

**Interfaces:**
- Consumes: `newBaleExpiry` and `isExpired`.
- Produces: idempotent expiration endpoint and allows a fresh attempt of the same method after expiration.

- [ ] Write failing tests for server expiry, paid-at-boundary behavior, same-method Bale restart, and fresh payload/deadline generation.
- [ ] Run the focused test and verify failure.
- [ ] Set `expiresAt` on Bale order/attempt creation and clear it for card-to-card.
- [ ] Implement expiration transaction that rechecks paid status before expiring active attempt and order.
- [ ] Permit `change-method` to create a new attempt when the prior attempt is expired, including Bale-to-Bale.
- [ ] Normalize stale pending Bale attempts when payment state is fetched.
- [ ] Run focused tests and `npm test`.
- [ ] Commit with `feat: expire and restart Bale payment attempts`.

### Task 4: Checkout Countdown And Success Polling

**Files:**
- Modify: `app/(site)/checkout/page.tsx`

**Interfaces:**
- Consumes: order `expiresAt`, `paid`, and `expired` statuses plus expiration endpoint.
- Produces: visible countdown, periodic status refresh, success state, and automatic return to method selection.

- [ ] Add server-deadline countdown state and Persian minute/second rendering.
- [ ] Poll current application payment every four seconds only while Bale is pending.
- [ ] At zero, call expiration endpoint; show success if paid or clear active order and retain order ID for restart if expired.
- [ ] Route method selection through existing-order restart when an expired order exists.
- [ ] Disable the Bale deep link after expiration and handle background-tab timer recovery from absolute `expiresAt`.
- [ ] Run `npm test` and `npm run build`.
- [ ] Commit with `feat: add Bale payment countdown flow`.

### Task 5: Admin Identifiers And Reconciliation

**Files:**
- Modify: `app/api/admin/payments/route.ts`
- Create: `app/api/admin/payments/[id]/reconcile-bale/route.ts`
- Modify: `app/admin/payments/page.tsx`
- Create: `tests/bale-payment-reconciliation.test.ts`

**Interfaces:**
- Consumes: shared inquiry/domain/finalization functions.
- Produces: authenticated reconciliation endpoint accepting tracking number and optional receipt reference.

- [ ] Write failing tests that reject unknown, unpaid, or amount-mismatched transactions and accept a paid matching transaction.
- [ ] Implement reconciliation using stored unique payment ID first and supplied/stored tracking number as observed-provider fallback.
- [ ] Include attempts in admin payments API and render payment ID, tracking number, receipt reference, deadline, paid time, and verification state.
- [ ] Add `استعلام و بازیابی پرداخت بله` for eligible Bale orders and refresh details after success.
- [ ] Run focused tests, `npm test`, and `npm run build`.
- [ ] Commit with `feat: reconcile Bale payments in admin`.

### Task 6: Deploy, Recover Historical Payment, And Verify

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: deployment script and reconciliation behavior from prior tasks.
- Produces: migrated production, online PM2 process, and recovered Ali Jalali order.

- [ ] Inspect `git status`, intended diff, recent commits, and ensure unrelated files remain unstaged.
- [ ] Push commits and run `/var/www/Emroschool/deploy-safe.sh` on the VPS.
- [ ] Verify Prisma migration, production build, and PM2 online status.
- [ ] Reconcile `PAY-1786280146021-B6F838` with tracking `5704241090258666016` and receipt reference `8260047130` only after rechecking `paid` and 4,000,000 IRR.
- [ ] Verify order and active attempt are paid, identifiers are stored, application is approved, and exactly one enrollment exists.
- [ ] Verify a test Bale attempt displays a 15-minute deadline and expiration returns checkout to method selection.
- [ ] Verify admin payment details expose customer-correlated Bale identifiers.
