# User Request Notifications And Payment Re-review Design

## Goal

Publish every actionable user request to the Bale coordination group using safe operational cards, and let payment admins correct card-to-card approval or rejection mistakes without deleting financial evidence or student progress.

## Scope

Group events cover:

- New support tickets.
- New user replies on support tickets; admin replies are excluded.
- New course applications.
- New card-to-card receipt submissions.
- New or repeated profile review requests.
- New avatar review submissions.
- Card-to-card payment review decisions and corrections.

Account creation, OTP traffic, admin replies, system notifications, free enrollment, manual enrollment, and direct Bale messages outside this application are excluded.

## Message Design

Use the approved operational-card style:

- A clear category heading and event title.
- Two or three allowlisted display fields.
- A Persian date/time.
- One primary glass button and, where useful, one secondary glass button.
- Buttons open authenticated admin pages; they never approve or reject directly inside Bale.

Support notifications include user display name, ticket subject, time, and admin links. The free-text message body is never copied.

Course application notifications include student name, course title, fixed pending-review state, time, and admin links.

Receipt notifications include student name, course, amount, order number, submission time, and payment-review link.

Profile and avatar notifications include user display name, request kind, time, and user-review link.

Never store or send phone numbers, email addresses, national codes, addresses, custom form responses, biographies, message bodies, file URLs, receipt images, payer cards, provider identifiers, passwords, tokens, or arbitrary request objects.

## Delivery Architecture

Extend the existing `BaleGroupEvent` transactional outbox. Every producer inserts an immutable event snapshot in the same Prisma transaction as the authoritative user-request transition. Delivery remains asynchronous and cannot roll back the user request.

New events use stable keys:

- `support-ticket:<ticketId>`
- `support-user-message:<messageId>`
- `course-application:<applicationId>`
- `payment-receipt:<attemptId>:<submittedAt>`
- `profile-review:<userId>:<revision>`
- `avatar-review:<submissionId>`
- `payment-review-decision:<decisionId>`

The dispatcher strictly validates the exact payload shape for every event type. Unknown types, extra fields, control characters, malformed dates, or oversized values transition to `needs_review` without sending. Existing claim, retry, uncertain-delivery, Cron, and lock behavior remains unchanged.

Inline keyboard buttons are part of the event payload as allowlisted action identifiers, not arbitrary URLs. The formatter maps each action to an authenticated admin URL derived from the configured public site origin. Bale delivery uses `sendMessage` with `reply_markup.inline_keyboard`; callback actions are not used.

## Card-to-card Re-review

Only `card_to_card` orders support decision correction. Manual and provider-confirmed Bale payments remain outside this workflow.

Add an append-only `PaymentReviewDecision` record for every approval, rejection, reopening, approval reversal, and reapproval. It stores actor, reason, previous and next states, attempt, timestamp, and a monotonic order review version. Existing mutable reviewer fields remain a current-state projection, not the audit source.

### Incorrect Rejection

An admin may reopen a rejected card payment without requiring a new customer receipt. Reopening moves the order and active attempt back to `under_review`, clears only the current rejection projection, retains the previous decision and receipt, and increments the review version. The admin then performs a new approve or reject action.

### Incorrect Approval

An admin may reverse an approved card decision only with a required reason. The paid evidence, receipt, original paid timestamp, and original decision are retained. The order and active attempt move to an explicit `review_reopened` state rather than pretending that no transfer occurred.

The application moves to `pending_payment`. Access granted by this payment is suspended, but enrollment progress and completion data are not deleted.

### Access Provenance

Add an append-only `EnrollmentGrant` source record. A grant identifies the source type and source ID and can be active or revoked. Existing paid, free, manual-admin, and direct-application enrollment paths create deterministic grants. Course access is active while at least one non-revoked grant exists.

Reversing a card approval revokes only that payment order's grant. It cannot revoke an independent free, manual, or administrative grant. Reapproval restores the same grant. Existing `Enrollment` rows remain as progress containers and are not deleted by payment re-review.

Authorization checks that currently rely on `Enrollment` must also require at least one active grant after the grant backfill is deployed. Deployment backfills existing enrollment rows with a legacy active grant before enforcing this access rule.

## Concurrency And Invariants

Every review mutation supplies the expected review version and current status. Conditional updates return `409` if another admin already changed the order.

The active attempt update is constrained by both attempt ID and order ID. Review decision, order, attempt, application, grant, and Bale outbox event commit in one transaction.

An already-sent payment announcement is never edited or deleted. Reopening, reversal, rejection, and reapproval create separate compensation events.

## Admin Experience

The payment detail modal shows:

- Current review state.
- Complete decision timeline with actor, reason, and time.
- `Reopen review` for rejected card payments.
- `Reverse approval` for approved card payments.
- Standard approve/reject actions while under review or reopened.
- A prominent access-suspended indicator when a paid grant is revoked.

All correction actions require confirmation and a reason. The UI sends the current review version and refreshes on `409` rather than overwriting another admin's decision.

## Testing

Tests cover each request producer, exact safe payloads, excluded sensitive values, repeated and concurrent submissions, rollback when outbox insertion fails, dispatcher validation, formatted glass buttons, and admin links.

Payment tests cover rejected-to-reopened-to-approved, paid-to-reopened-to-reapproved, paid-to-reopened-to-rejected, reason requirements, stale-version conflicts, decision history, attempt ownership, payment-grant revocation/restoration, preservation of independent grants and progress, compensating events, and transaction rollback.

Real Prisma integration verifies unique keys, review versions, grant provenance, and backfill behavior. Full tests, TypeScript, production build, Linux deployment tests, and post-deploy outbox/Cron verification are required before completion.
