# User Request Notifications And Payment Re-review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish safe operational Bale cards for every actionable user request and provide audited, reversible card-to-card payment decisions with source-specific access suspension.

**Architecture:** Extend the existing transactional `BaleGroupEvent` outbox with exact payload validators and allowlisted inline-keyboard actions. Add append-only payment decisions and enrollment grants so card review corrections preserve financial evidence and progress while revoking only payment-derived access.

**Tech Stack:** Next.js 14, TypeScript, Prisma/SQLite, Bale Bot API, React admin UI, Node test runner, Linux Cron/flock.

## Global Constraints

- Use the existing `BALE_COORDINATION_CHAT_ID` destination and never commit tokens or production identifiers.
- Never place free-text messages, contact details, identity data, addresses, arbitrary form answers, file URLs, images, card data, provider identifiers, or secrets in group event payloads.
- Use the approved operational-card message hierarchy and allowlisted inline keyboard actions that open authenticated admin pages.
- User-request state commits independently of Bale delivery; every outbox row is immutable and idempotent.
- Payment correction applies only to `card_to_card` orders and requires a reason plus optimistic concurrency.
- Preserve payment evidence, decision history, enrollment progress, and independent access sources.
- Preserve unrelated working-tree changes.

---

### Task 1: Request Events And Glass Buttons

**Files:**
- Modify: `lib/bale-group-notifications.ts`
- Modify: `lib/bale-payment.ts`
- Modify: `scripts/dispatch-bale-group-events.ts`
- Modify: `app/api/support/tickets/route.ts`
- Modify: `app/api/support/tickets/[id]/route.ts`
- Modify: `app/api/course-applications/route.ts`
- Modify: `app/api/payments/[id]/receipt/route.ts`
- Modify: `app/api/user/profile/route.ts`
- Modify: `app/api/user/avatar/route.ts`
- Modify: `tests/bale-group-notifications.test.ts`
- Modify: `tests/bale-group-dispatcher.test.ts`
- Create: `tests/bale-user-request-producers.test.ts`

**Interfaces:**
- Produces event types `support_ticket`, `support_user_message`, `course_application`, `payment_receipt`, `profile_review`, and `avatar_review`.
- Produces `sendMessage(chatId, text, options?)` where options accepts only an inline keyboard generated from allowlisted action identifiers.

- [ ] Add failing formatter/validator tests with exact safe payloads, Persian timestamps, approved card hierarchy, and inline actions; assert exclusion of message bodies, phone, email, national code, address, custom responses, file/receipt URLs, cards, and tokens.
- [ ] Add failing producer tests proving each authoritative transition queues one immutable event in the same transaction, repeated submissions do not duplicate it, admin support replies are excluded, and outbox insertion failure rolls back the request transition.
- [ ] Run `npx tsx --require ./tests/server-only-test-register.cjs --test tests/bale-group-notifications.test.ts tests/bale-group-dispatcher.test.ts tests/bale-user-request-producers.test.ts` and verify RED for missing event support.
- [ ] Implement narrow payload types, stable event keys, queue helpers, operational-card formatters, strict dispatcher parsing, and action-to-admin-URL mapping based on the configured public origin.
- [ ] Extend Bale `sendMessage` with validated `reply_markup.inline_keyboard` without changing other API method result contracts.
- [ ] Hook ticket creation/user replies, course application creation, receipt submission, profile pending-review transitions, and avatar submission transactionally; replace the receipt route's direct notification.
- [ ] Run focused tests, TypeScript, Prisma validation, and `git diff --check`.
- [ ] Commit `feat: notify Bale group of user requests`.

### Task 2: Payment Decisions And Enrollment Grants

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/payment-review.ts`
- Modify: `app/api/admin/payments/[id]/route.ts`
- Modify: `app/api/payments/route.ts`
- Modify: `lib/bale-payment-finalization.ts`
- Modify: `app/api/admin/payments/manual/route.ts`
- Modify: `app/api/admin/users/[id]/enroll/route.ts`
- Modify: `app/api/course-applications/[id]/route.ts`
- Create: `scripts/backfill-enrollment-grants.ts`
- Modify: `package.json`
- Create: `tests/payment-review.test.ts`
- Modify: `tests/bale-payment-prisma-integration.test.ts`

**Interfaces:**
- Produces append-only `PaymentReviewDecision` and source-specific `EnrollmentGrant` records.
- Produces actions `approve`, `reject`, `reopen_rejection`, and `reverse_approval` with `{ reason, expectedReviewVersion }` where corrections require non-empty reason.
- Produces `hasActiveEnrollmentGrant(tx, userId, courseId)` and deterministic grant helpers for paid, free, manual-admin, and legacy sources.

- [ ] Write failing domain/API tests for rejection reopening, approval reversal, reapproval, final rejection, mandatory reasons, stale-version `409`, attempt ownership, append-only decisions, and immutable financial evidence.
- [ ] Write failing grant tests proving payment-only access suspension/restoration, preservation of progress, and preservation of independent free/manual/legacy grants.
- [ ] Write a failing real-Prisma backfill test proving every existing enrollment receives one idempotent legacy active grant.
- [ ] Run `npx tsx --require ./tests/server-only-test-register.cjs --test tests/payment-review.test.ts tests/bale-payment-prisma-integration.test.ts` and verify RED.
- [ ] Add schema models and review-version fields; implement conditional transaction updates and decision history.
- [ ] Create/restore/revoke deterministic grants in every enrollment-producing path and reject direct application reversal when a paid order requires the payment workflow.
- [ ] Add an idempotent grant backfill CLI and package script; do not enforce grant-aware authorization until backfill integration is complete.
- [ ] Run focused payment tests, Prisma generate/validate, TypeScript, and `git diff --check`.
- [ ] Commit `feat: add audited card payment rereview`.

### Task 3: Admin UI, Access Enforcement, Compensation Events, And Deploy

**Files:**
- Modify: `app/admin/payments/page.tsx`
- Modify: `lib/bale-group-notifications.ts`
- Modify: `scripts/dispatch-bale-group-events.ts`
- Modify enrollment authorization queries found by search in course/user APIs.
- Modify: `deploy-safe.sh`
- Modify: `tests/deploy-safe.test.ts`
- Modify: `tests/bale-group-notifications.test.ts`
- Modify: `tests/bale-group-dispatcher.test.ts`
- Create: `tests/payment-review-ui.test.ts`

**Interfaces:**
- Produces a payment decision timeline and correction controls with reason confirmation and review-version conflict refresh.
- Produces compensation event `payment_review_decision` keyed `payment-review-decision:<decisionId>`.
- Makes course access require at least one active enrollment grant after deployment backfill.

- [ ] Add failing UI contract tests for timeline rendering, reopen/reverse controls, required reason, suspended-access indicator, and `409` refresh behavior.
- [ ] Add failing group tests for separate correction messages with safe fields and admin payment button.
- [ ] Add failing authorization tests proving revoked-only grants deny course access while any active independent grant preserves it.
- [ ] Add failing deploy tests proving grant backfill runs after schema push and before restart/access enforcement.
- [ ] Implement the admin payment UI, decision timeline, correction actions, compensation events, and active-grant authorization filters.
- [ ] Update deployment to run the idempotent enrollment-grant backfill before build/restart and preserve existing backup/lock/Cron safety.
- [ ] Run `npm test`, `npx tsc --noEmit --incremental false`, `npx prisma validate`, `npm run build`, and `git diff --check` sequentially.
- [ ] Review all commits and push `master` only after Windows tests and Linux deploy tests pass without failures.
- [ ] Configure no new secrets, deploy with `/var/www/Emroschool/deploy-safe.sh`, and verify PM2 online, HTTP 200, Cron active, request events dispatch, correction history/grants, and secret-free logs.
- [ ] Commit `feat: complete payment rereview workflow`.
