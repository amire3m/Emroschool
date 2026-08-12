# Bale Coordination Group Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably send new paid-order, duplicate-payment, and deployed-release summaries to the configured Bale coordination group.

**Architecture:** Paid transactions insert unique `BaleGroupEvent` outbox rows atomically. A lock-safe one-shot dispatcher run by Cron claims due rows, sends through the existing Bale Bot API, and records sent/retry/uncertain outcomes; deployment reconciles static release cards into the same ledger.

**Tech Stack:** Next.js 14, TypeScript, Prisma/SQLite, Bale Bot API, Bash Cron/flock, Node test runner.

## Global Constraints

- Read destination from `BALE_COORDINATION_CHAT_ID`; never commit the bot token or real production token.
- Notify all paid methods, but never free/manual access without a paid order and never backfill historical payments.
- Payment success must not depend on Bale delivery.
- Event keys are unique: `payment-paid:<orderId>`, `payment-duplicate:<attemptId>`, `release:<releaseId>`.
- Retry definitive rejection up to 10 attempts with increasing one-minute delay; uncertain delivery is not blindly retried.
- Messages include only student name, course, amount, method, order number, and safe date.
- Preserve unrelated working-tree changes.

---

### Task 1: Durable Outbox And Payment Hooks

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/bale-group-notifications.ts`
- Modify: `lib/bale-payment-finalization.ts`
- Modify: `app/api/admin/payments/[id]/route.ts`
- Modify: `app/api/admin/payments/manual/route.ts`
- Create: `tests/bale-group-notifications.test.ts`

**Interfaces:**
- Produces `queuePaidPaymentEvent(tx, order, paidAt)`, `queueDuplicatePaymentEvent(tx, order, attemptId, paidAt)`, `formatBaleGroupEvent(event)`, and retry/claim domain helpers.

- [ ] Write failing tests for safe Persian formatting, unique event keys, first paid transition, duplicate charge, card approval, manual payment, no repeated events, and excluded sensitive fields.
- [ ] Run `npx tsx --test tests/bale-group-notifications.test.ts` and verify RED.
- [ ] Add `BaleGroupEvent` with unique key, type, payload, status, attempts, scheduling/claim/sent timestamps, error and provider ID.
- [ ] Implement queue helpers that snapshot user/course display fields inside the payment transaction using create-with-unique-key semantics.
- [ ] Hook normal and duplicate Bale finalization, approved card-to-card, and manual paid creation.
- [ ] Run focused payment/outbox tests and TypeScript.
- [ ] Commit `feat: queue Bale group payment events`.

### Task 2: Dispatcher And Release Reconciliation

**Files:**
- Create: `scripts/dispatch-bale-group-events.ts`
- Create: `scripts/reconcile-bale-release-events.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Create: `tests/bale-group-dispatcher.test.ts`

**Interfaces:**
- Produces one-shot `dispatchBaleGroupEvents()` and `reconcileBaleReleaseEvents()` CLIs.

- [ ] Write failing tests for atomic claim, successful send, definitive retry schedule, attempt 10 review, uncertain outcome, per-event isolation, missing configuration, release 2.2 summary, and repeated reconciliation.
- [ ] Run focused tests and verify RED.
- [ ] Implement dispatcher with bounded batch, stale pre-send claim recovery, safe error text, and existing `sendMessage` classification.
- [ ] Implement release grouping: each release event includes capability cards newer than the preceding release and not newer than that release; initial `version-2-2` queues once.
- [ ] Add npm scripts and documented chat-ID environment variable.
- [ ] Run focused tests and TypeScript.
- [ ] Commit `feat: dispatch Bale group notifications`.

### Task 3: Deployment, Cron, And Production

**Files:**
- Modify: `deploy-safe.sh`
- Modify: `tests/deploy-safe.test.ts`

**Interfaces:**
- Deployment reconciles releases after successful build/restart and installs a root minute Cron using `flock` without embedding secrets.

- [ ] Add failing deploy tests for release reconciliation and idempotent `/etc/cron.d/emroschool-bale-notifications` installation.
- [ ] Implement post-restart reconciliation, one immediate dispatch, and Cron installation using absolute paths.
- [ ] Run `npm test`, TypeScript, build, and `git diff --check` sequentially.
- [ ] Review and commit only task files.
- [ ] Push master, configure production token/chat ID, run schema/deploy, verify Cron and PM2, send version 2.2 once, and confirm event status `sent` plus no sensitive content/log errors.
