# Bale Coordination Group Notifications Design

## Goal

Use `@imamruhollahschool_bot` to notify the Bale course-coordination group about successful payments, duplicate payments, and each deployed site release.

## Scope

- Destination is the Bale group chat ID configured as `BALE_COORDINATION_CHAT_ID=5747262000`.
- Reuse `BALE_BOT_TOKEN`; secrets and production chat IDs remain environment configuration and are never committed.
- Cover successful Bale wallet payments, reconciled Bale payments, approved card-to-card payments, and manual paid orders.
- Do not notify for free enrollment, application approval without payment, direct enrollment, or historical payments.
- Send one initial release message for version `2.2.0`; later releases send one summary message per release card with all newer capability cards.

## Durable Event Model

Add `BaleGroupEvent` with:

- unique `eventKey`
- `type`: `payment_paid`, `payment_duplicate`, or `release`
- JSON payload snapshot containing only message-safe fields
- status: `pending`, `processing`, `retryable`, `uncertain`, `sent`, or `needs_review`
- attempt count, next-attempt time, claim timestamp, sent timestamp, last error, and provider response identifier when available

Keys:

- `payment-paid:<orderId>`
- `payment-duplicate:<attemptId>`
- `release:<releaseNoteId>`

The paid-order transaction inserts its event during the first unpaid-to-paid transition. Duplicate Bale charges insert a separate warning event. Payment commit never depends on message delivery.

## Payment Convergence

Create a method-independent paid-order helper used by:

- Bale webhook and Bale reconciliation through the shared finalizer
- card-to-card approval
- manual payment creation

It updates the order and attempt when present, approves the application, creates enrollment, and inserts the unique outbox event in the same transaction. Existing Bale validation and duplicate-charge rules remain around this helper.

The event payload snapshots:

- student name
- course title
- amount in tomans
- payment method label
- order number
- paid timestamp

No phone, full card number, encrypted card data, Bale payload, or internal provider secrets are included.

## Message Formats

Successful payment:

```text
✅ پرداخت موفق
هنرجو: ...
دوره: ...
مبلغ: ... تومان
روش پرداخت: ...
شماره سفارش: ...
```

Duplicate payment uses a prominent `⚠️ پرداخت تکراری؛ نیازمند پیگیری` heading with the same safe fields.

Release announcement contains version, release title/date, and a concise bullet list of capability titles included since the preceding release. Version `2.2.0` is queued once during rollout; historical payments are not backfilled.

## Dispatcher And Retry

- A CLI dispatcher runs from server Cron every minute under `flock`.
- It atomically claims due events, sends through the existing Bale `sendMessage(chatId, text)`, and records the result.
- Definitive non-delivery becomes `retryable` with increasing one-minute delay based on attempt count.
- After 10 attempts it becomes `needs_review`.
- Timeout, malformed success, or other uncertain provider outcome becomes `uncertain` and is not blindly resent.
- A stale `processing` claim can be recovered only when no send was attempted; post-send unknown outcomes remain `uncertain`.
- One failed event does not block other due events.

## Release Trigger

After a successful application build and restart, deployment runs a release reconciliation CLI. It compares deployed release-card IDs with the event ledger and queues unsent release announcements. The dispatcher sends them. Release notification failure does not roll back a successful deployment.

## Operations

- Add the chat ID to `.env.example` without the real token.
- Install a root Cron entry that runs the dispatcher every minute with an absolute app path and lock file.
- Validate bot membership and destination with one explicit test message before enabling payment events.
- Provide CLI output for queued/sent/retryable/uncertain/needs-review counts.
- Do not log the bot token or sensitive payment fields.

## Testing

- Domain tests for event keys, safe payloads, Persian formatting, retry timing, and status transitions.
- Transaction tests proving one event per first paid transition across all four payment paths and a separate duplicate-payment event.
- Crash/idempotency tests proving repeated webhook/reconciliation/approval/manual requests do not duplicate events.
- Dispatcher tests for success, definitive retry, tenth-attempt review, uncertain delivery, atomic claims, and per-event isolation.
- Release reconciliation tests proving version `2.2.0` queues once with 18 capabilities and repeated runs are idempotent.
- Full tests, TypeScript, production build, schema push, deployment, Cron inspection, test message, and production log verification.

## Success Criteria

- Every new paid order from any supported paid method creates exactly one group message event.
- Every distinct duplicate charge creates one warning event.
- Version `2.2.0` is announced once with its capability summary; later releases follow the same rule.
- Payment remains successful when Bale messaging is unavailable.
- Retryable failures self-heal; uncertain outcomes and exhausted retries are visible for review.
