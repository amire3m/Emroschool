# Bale Payment Reliability Final Fix Report

## Status

COMPLETE. All nine final-review findings were addressed and committed. No deployment, push, production database mutation, or historical payment reconciliation was performed.

## Finding Map

### 1. Legacy nullable Bale deadlines

- `lib/bale-payment-domain.ts` defines `effectiveBaleExpiry`, using the stored deadline when present and otherwise exactly `createdAt + 15 minutes`.
- `scripts/backfill-bale-payment-attempts.ts` is a reusable, idempotent deploy backfill. It persists missing attempt deadlines, expires old pending attempts, preserves identifiers and paid status, and normalizes the active order deadline/status.
- `package.json` exposes the backfill as `npm run db:backfill-bale-payments`.
- `/start`, precheckout, payment GET normalization, expiration, and same-method restart all apply the same effective deadline. GET and expiration commit missing deadlines; precheckout and invoice claim persistence also commit the derived attempt deadline.
- Customer checkout receives the normalized server deadline through GET, so null legacy data cannot create an endless zero-countdown loop.
- Tests: `tests/bale-payment-domain.test.ts`, `tests/bale-payment-webhook.test.ts`, `tests/bale-payment-expiration.test.ts`, and `tests/bale-payment-prisma-integration.test.ts` cover fresh/expired null-deadline records, precheckout, `/start`, GET, expiration, restart compatibility, evidence preservation, and late finalization.

### 2. Repeat invoices and precheckout overwrite

- `prisma/schema.prisma` adds durable `baleInvoiceClaimId` and `baleInvoiceClaimedAt` fields alongside `baleInvoiceSentAt`.
- `app/api/bale/webhook/[secret]/route.ts` atomically claims an unsent attempt with `updateMany`. Repeated and concurrent `/start` deliveries cannot send after another request owns the claim or has marked the invoice sent.
- A pre-send setup or `sendInvoice` failure releases only its matching claim. A failure after the provider send leaves the claim durable, preventing an unsafe repeat invoice.
- `lib/bale-payment-finalization.ts` rejects a different precheckout ID once the first ID is stored. The same ID is idempotent and preserves the first approval time.
- Tests: repeated/concurrent start, send failure recovery, two different precheckouts, same-ID replay, first approval preservation, and Prisma schema coverage are in `tests/bale-payment-webhook.test.ts` and `tests/bale-payment-prisma-integration.test.ts`.

### 3. Reconciliation selector and explicit selection

- `lib/bale-payment-reconciliation.ts` prefers the newest unresolved evidence-bearing attempt before an empty active attempt.
- The selector accepts an explicit attempt ID only when it belongs to the order's Bale history and remains unresolved.
- `app/api/admin/payments/[id]/reconcile-bale/route.ts` and `app/admin/payments/page.tsx` use the same selector. The admin UI displays an attempt chooser when multiple unresolved Bale attempts exist.
- Tests cover old `received` evidence plus a newer empty active attempt, deterministic ordering, explicit safe selection, and route-level use of the explicit attempt.

### 4. Inquiry payer ownership and admin provenance

- The reconciliation route normalizes inquiry `userID` and requires it to match stored `payerBaleId` or private `baleChatId` evidence when either exists.
- A missing or different inquiry payer is rejected before mutation.
- If no payer evidence exists, the request must contain a non-empty receipt reference and `confirmUnmatchedPayer: true`.
- Successful reconciliation records `reviewerId` and `reviewedAt` atomically with finalization.
- The admin UI explains the risk, requires the receipt reference and explicit ownership checkbox only on no-evidence orders, and states that reviewer provenance is recorded.
- Tests cover matching identity, mismatching identity, rejected unconfirmed no-evidence recovery, successful explicit confirmation, and reviewer/time persistence.

### 5. Finalizer active-attempt scoping

- `lib/bale-payment-finalization.ts` uses `updateMany` scoped by both `id` and `orderId` for paid, duplicate-paid, evidence, and stale-active-attempt updates.
- A malformed foreign `activeAttemptId` is not mutated; the valid paid attempt still becomes authoritative for its order.
- Test: `finalization does not invalidate an active attempt owned by another order` in `tests/bale-payment-webhook.test.ts`.

### 6. SQLite-consistent deployment backup

- `deploy-safe.sh` copies uploads while the application remains online.
- It stops the PM2 writer only around SQLite checkpoint and database/journal copy, including `dev.db`, `dev.db-wal`, `dev.db-shm`, and `dev.db-journal` when present.
- An EXIT trap attempts PM2 restart whenever the writer is still stopped, including backup-copy failure. A normal backup restarts the writer before pull/install/schema/build work.
- Deployment runs `prisma db push`, then `npm run db:backfill-bale-payments`, then builds and performs the final restart.
- `tests/deploy-safe.test.ts` executes the script under Git Bash with temporary application data and stubbed PM2/tool commands. It proves restart after forced backup failure, checkpoint/copy ordering, WAL preservation, and backfill ordering.
- Operational behavior is documented in `docs/superpowers/specs/2026-08-10-bale-payment-reliability-design.md`.

### 7. Real Prisma/SQLite integration coverage

- `tests/bale-payment-prisma-integration.test.ts` pushes the real Prisma schema to a temporary SQLite database and uses a real `PrismaClient`.
- It proves the backfill persists exact deadlines, expires pending and evidence-bearing legacy attempts without deleting evidence, leaves paid attempts paid, normalizes the order, and permits a late authoritative payment to finalize after expiration.
- No mounted React/component test framework exists in this repository. UI lifecycle coverage remains pure-helper/API integration, typecheck, build, detector, and code review; this report does not claim mounted React coverage.

### 8. Concurrent initial order P2002

- `app/api/payments/route.ts` recognizes an initial creation `P2002`, queries by the unique application ID, verifies user ownership, and returns the winning existing order instead of HTTP 500.
- Test: `returns the concurrently created order after an initial P2002` in `tests/bale-payment-expiration.test.ts`.

### 9. Customer GET attempt projection

- Customer GET now uses an explicit order `select` and attempt allowlist containing only `id`, `sequence`, `method`, `status`, `createdAt`, and `expiresAt`.
- The server performs a separate scoped payload lookup only to generate the Bale deep link, then defensively reconstructs every attempt response from the allowlist.
- Customer JSON cannot expose `balePayload`, payment IDs, tracking numbers, receipt reference, verification state, or other recovery internals.
- Test: `customer GET selects and returns only checkout-safe attempt fields` in `tests/bale-payment-expiration.test.ts` asserts both Prisma projection and serialized response fields.

## TDD Evidence

- Domain RED: `effectiveBaleExpiry is not a function`.
- Webhook RED: a different precheckout ID returned `true`; repeated starts lacked durable claim behavior; send failure recovery was absent.
- Expiration/API RED: initial `P2002` returned 500; null-deadline GET remained pending; customer query had no explicit attempt projection.
- Reconciliation RED: the empty active attempt beat older evidence; mismatched payer and unconfirmed no-evidence inquiry both returned 200.
- Prisma RED: the backfill module did not exist.
- Deployment RED: forced backup failure produced no PM2 stop/restart log; successful flow had no checkpoint, journal backup, or post-push backfill.
- Every RED was followed by focused GREEN runs before the full suite.

## Verification

- `npm test`: exit 0, 102 passed, 0 failed, including real Prisma/SQLite and executable deployment tests.
- `npx prisma validate`: exit 0; schema valid.
- `npx tsc --noEmit --incremental false`: exit 0; no diagnostics.
- `npm run build`: exit 0; compilation, route validation, type checking, 99-page generation, and trace collection completed.
- `node C:\Users\Novin\.config\opencode\skills\impeccable\scripts\detect.mjs --json "app/admin/payments/page.tsx"`: returned `[]`.
- `git diff --cached --check`: exit 0 before the implementation commit.
- Build output retained the documented empty-worktree Prisma `P2021` prerender warnings for missing local `DiscountCode`, `Category`, and `Course` tables. The build completed successfully.

## Self-Review

- Confirmed all attempt mutations called out by the finalizer finding are scoped by attempt and order.
- Confirmed late successful payment validation remains independent of expiry and inquiry.
- Confirmed evidence-bearing expired attempts remain selectable and finalizable.
- Confirmed pre-send database failures and explicit provider rejections release invoice ownership; timeout, network, malformed 2xx, and post-send persistence uncertainty retain ownership to prevent a repeat.
- Confirmed API and UI share selector semantics and the UI does not claim lifecycle coverage absent from the repository.
- Confirmed customer GET generates the deep link server-side without serializing payload or verification evidence.
- Confirmed deployment never leaves PM2 intentionally stopped after the backup window and uploads remain included.
- No Critical or Important self-review findings remain. A dedicated reviewer subagent was unavailable in this tool environment, so review was performed in-thread against the complete diff and requested invariants.

## Commits

- `0b6e11c` — `fix: close Bale payment reliability gaps`
- Final report commit: recorded in repository history immediately after this report was added.

## Residual Concerns

- If Bale accepts an invoice but persisting `baleInvoiceSentAt` fails, the durable claim is intentionally retained to prevent a duplicate invoice. That attempt requires operator investigation rather than automatic claim expiry because the provider call has no idempotency key.
- Tracking-number inquiry remains an empirically verified fallback, not a documented provider identifier contract; stored unique payment ID remains preferred.
- The deployment test uses a real POSIX shell with stubbed PM2/npm/git/SQLite commands and temporary files. It does not replace post-deploy VPS health checks, which were explicitly out of scope because deployment was forbidden.
- The repository still has no mounted React/browser lifecycle harness. The new admin controls are covered by shared selector/API tests, TypeScript, production build, detector, and static self-review.

## Residual Blocker Remediation

### Delivery-aware invoice claims

- `lib/bale-payment.ts` now emits `BaleApiError` with `definitive_rejection` or `delivery_uncertain`, while preserving the existing token-redacted error messages.
- Missing configuration, explicit HTTP 4xx responses, and explicit `ok: false` envelopes on otherwise successful HTTP responses are definitive because they communicate rejection. HTTP 5xx responses, fetch/network/timeout failures, and malformed 2xx protocol responses are uncertain because Bale may have accepted the request before the client lost a usable response.
- `/start` releases its durable claim after pre-send database failure or a definitive Bale rejection. It retains the claim after uncertain delivery and therefore acknowledges later repeated starts without sending another invoice.
- Focused RED proved uncertain failures cleared the claim and the Bale error classifier was absent. Focused GREEN covers explicit rejection retry, timeout/network claim retention, malformed 2xx claim retention, no resend, successful sent-state persistence, and safe HTTP-boundary classification.

### Unified customer POST projection

- `app/api/payments/route.ts` now defines one explicit checkout order/attempt select and one defensive serializer shared by GET and all order-returning POST branches.
- New creation, existing application order, and concurrent P2002 winner all reload by user-scoped criteria through that projection.
- The active payload is selected separately by active attempt and order ID only to build `baleBotUrl`. Neither order-level nor attempt-level payload is serialized.
- Exact response-key tests cover all three POST branches and reject raw payload, payment ID, tracking number, receipt reference, verification status, claim ID, and an injected future field.
- The unused `balePayload` property was removed from the checkout page's customer order type.

### Residual verification

- `npm test`: exit 0; 108 passed, 0 failed.
- `npx prisma validate`: exit 0; schema valid.
- `npx tsc --noEmit --incremental false`: exit 0; no diagnostics.
- `npm run build`: exit 0; production build and 99-page generation completed with only the previously documented empty-worktree missing-table warnings.
- No deployment, push, merge, production database change, or historical reconciliation was performed.

## HTTP Status Classification Follow-Up

### Corrected behavior

- `lib/bale-payment.ts` now classifies HTTP 4xx as `definitive_rejection`, so `/start` releases the matching invoice claim and permits a later retry.
- HTTP 5xx and other unusable non-4xx HTTP responses are `delivery_uncertain`, so `/start` retains the durable claim and cannot repeat an invoice whose provider outcome is unknown.
- A well-formed `ok: false` envelope on an otherwise successful HTTP response remains a definitive application rejection. Network/timeout and malformed 2xx responses remain uncertain. Existing token-redacted diagnostics are unchanged.
- No webhook code change was necessary; its existing release/retain branch already consumes `BaleDeliveryStatus` correctly.

### Exact TDD evidence

- RED boundary command: `node --import tsx --input-type=module -e "import assert from 'node:assert/strict'; process.env.BALE_BOT_TOKEN='bot-token'; globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,description:'gateway failure'}),{status:502,headers:{'Content-Type':'application/json'}}); const {sendMessage,isDefinitiveBaleApiRejection}=(await import('./lib/bale-payment.ts')).default; await assert.rejects(sendMessage('chat-1','invoice'),(error)=>!isDefinitiveBaleApiRejection(error));"` exited 1 with `AssertionError [ERR_ASSERTION]: The validation function is expected to return "true". Received false`; the caught `BaleApiError` had `baleDeliveryStatus: 'definitive_rejection'` for HTTP 502. Initial focused test-runner attempts containing the new route-level tests were terminated by the Windows command wrapper without usable TAP output, so they are not claimed as RED evidence.
- GREEN focused command: `& ".\\node_modules\\.bin\\tsx.cmd" --test "tests\\bale-payment-webhook.test.ts"` exited 0 with 42 passed, 0 failed. This includes HTTP 502 and 503 claim retention with no repeat fetch, and HTTP 400 claim release followed by a successful retry.

### Follow-up verification

- `npm test`: exit 0; 111 passed, 0 failed.
- `npx prisma validate`: exit 0; `prisma/schema.prisma` is valid.
- `npx tsc --noEmit --incremental false`: exit 0; no diagnostics.
- `npm run build`: exit 0; compilation, type validation, 99-page generation, and trace collection completed. Output contained only the previously documented empty-worktree `P2021` warnings for missing local `DiscountCode` and `Category` tables.
- No deployment, push, merge, production database mutation, or historical reconciliation was performed.
