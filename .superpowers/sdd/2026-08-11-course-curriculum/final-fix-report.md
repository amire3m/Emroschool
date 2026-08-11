# Course Curriculum Final Fix Report

Date: 2026-08-11

## Scope And Baseline

- Reviewed branch baseline: `8e0339b` (`fix: separate course refresh outcomes`).
- Reviewed the current domain normalizer, controlled editor input path, public summary component, POST and PUT route handlers, Prisma schema/DMMF, transaction helper, deployment script, deployment tests, persistence tests, and established dependency-override route tests before editing production code.
- Prisma evidence: `CourseLesson.durationMinutes` is declared `Int?`; Prisma DMMF reports scalar type `Int`. Prisma `Int` uses the signed 32-bit range, so the positive persisted range is `1..2_147_483_647`.
- Final commit: the commit containing this report. Its exact hash is returned with the completion result and is available with `git rev-parse HEAD`; a commit cannot embed its own content-derived hash.

## Root-Cause Investigation

### Duration Boundary

- `normalizeCurriculum` accepted every positive JavaScript integer. Therefore `2_147_483_648` crossed the API boundary and reached Prisma.
- `normalizeMinuteInput` accepted every positive safe integer. The editor therefore converted values beyond Prisma `Int` into numeric curriculum state and cleared custom validity.
- The POST route already translated normalization exceptions to the fixed response `{ error: "ساختار سرفصل‌های دوره نامعتبر است" }` with status 400, but overflow did not throw during normalization. It reached transaction/persistence and became the generic 500 response.
- Hypothesis: one shared `2_147_483_647` ceiling at domain normalization and editor parsing would reject the value at both trust boundaries while preserving exact-max behavior.

### Deployment Window

- The original script stopped PM2 only around SQLite checkpoint/backup and called `restart_writer` immediately afterward.
- The observed command trace was `stop -> checkpoint -> backup -> restart -> pull -> npm ci -> db push -> backfill -> build -> restart`.
- That allowed a live SQLite writer during schema deployment and made the backup stale as soon as the restarted app wrote again.
- The unconditional EXIT trap was appropriate only while the old app/build/schema combination remained known-compatible. After dependencies, schema, or build output begin changing, automatic restart can serve an incompatible combination.
- Hypothesis: stop once before checkpoint, retain automatic restart only through backup completion, mark the transition restart-unsafe before changing the checkout, and restart only after `db push -> backfill -> build` all succeed.

### Zero Duration Summary

- `Summary` always rendered the clock row and called `formatCurriculumDuration(0)`, producing `۰ دقیقه` even when every lesson duration was unavailable.
- Hypothesis: condition the duration row on `totalDurationMinutes > 0` without changing chapter/lesson counts or per-lesson rendering.

### Write Route Coverage

- Existing persistence tests honestly exercised synchronization and rollback against temporary SQLite, but did not call POST or PUT.
- Existing route tests established optional dependency overrides as the smallest direct-handler seam.
- The course handlers used module-level Prisma/auth dependencies directly, preventing an isolated real-database route harness.
- Hypothesis: route-local default dependencies with optional test overrides would preserve production behavior and allow direct handler tests against a temporary Prisma database without weakening transaction architecture.

## RED Evidence

All tests below were run against unchanged production code before the corresponding fix.

- Domain boundary: failed with `Missing expected exception` for `2_147_483_648`; exact max was accepted.
- Editor boundary: failed because `normalizeMinuteInput("2147483648")` returned numeric `2147483648` instead of retaining the invalid draft string.
- Public view: failed because locked markup contained both `مدت کل` and `۰ دقیقه`; the enrolled case used the same unconditional summary component.
- Route integration: overflow POST returned 500 instead of the fixed Persian 400; foreign ownership and omitted/empty tests returned 500 because the real temporary database override was not wired.
- Deployment order: successful trace placed `pm2 restart emroschool` between checkpoint/backup and `npx prisma db push`.
- Deployment failure: both `npm ci` failure and `prisma db push` failure traces already contained a PM2 restart, proving incompatible or indeterminate state could be served.
- Deployment schema/build order self-review test: failed while the intermediate implementation built before schema push, confirming the established `db push -> backfill -> build` sequence needed restoration inside the exclusive window.

## Fixes

- Added shared `PRISMA_INT_MAX = 2_147_483_647` and enforced it in `normalizeCurriculum`.
- Reused that bound in editor numeral normalization. Exact max becomes a number; max plus one remains a string, receives custom validity, and cannot overwrite the last valid numeric curriculum value.
- Rendered total duration only when `totalDurationMinutes > 0` for both locked and enrolled summaries.
- Added route-local default `db` and `authorize` dependencies to POST and PUT and routed every write-side lookup and transaction through them. Normal framework calls still use the same production Prisma/auth implementations.
- Added direct handler integration tests using a temporary SQLite database generated from the real Prisma schema.
- Stopped PM2 before SQLite checkpoint and retained that stop through pull, install, schema push, backfill, and build.
- Added `RESTART_SAFE`: backup/checkpoint failures restart the unchanged deployment; failures after the transition begins leave PM2 stopped and print explicit recovery instructions to complete deployment or restore the timestamped backup.
- Preserved deployment order as `git pull -> npm ci -> prisma db push -> backfill -> clean/build -> restart`.

## Route Behavior Proven

- Unauthenticated POST and PUT return the fixed Persian 403 before database access.
- Invalid overflow duration and empty title return the fixed Persian curriculum 400 before transaction execution.
- A foreign chapter ID returns only the fixed Persian 409, leaks no foreign title/detail, and rolls the surrounding course update back in real SQLite.
- Omitting `curriculum` preserves persisted chapters; explicitly sending `curriculum: []` deletes chapters and lessons transactionally.
- Existing real-database persistence tests continue to prove foreign lesson rejection, ownership checks before mutation, synchronization, deletion, and rollback.

## Verification

Final verification was run sequentially after the last production edit.

- Focused curriculum domain/editor/view/route/persistence/access plus deploy tests: 63 passed, 0 failed.
- `npm test`: 173 passed, 0 failed.
- `npx prisma validate`: schema valid.
- `npx tsc --noEmit --incremental false`: passed with no diagnostics.
- `npm run build`: exited 0, compiled successfully, generated 99/99 static pages, and completed optimization/traces.
- `git diff --check`: exited 0; Git emitted only workspace line-ending conversion notices.
- Impeccable UI detector on both changed curriculum components: no findings (`[]`).

## Self-Review

- Reviewed the full fix diff and untracked route test after verification.
- Changes are limited to curriculum validation/editor/view/write handlers, executable deployment behavior/tests, and this report.
- No schema change, destructive Git operation, privacy-boundary relaxation, raw ownership detail, or unrelated refactor was introduced.
- The handler seam follows an existing repository pattern and defaults to the original production dependencies.
- The deployment trap cannot restart after the restart-safe point; successful restart clears `APP_STOPPED`, preventing a second EXIT restart.

## Residual Risks

- Deployment tests execute the real shell script with controlled command binaries, but do not run a real PM2 process or induce actual SQLite lock contention on the production host.
- Recovery after a post-backup failure is intentionally manual and fail-closed. Operators must complete deployment or restore the reported backup before restarting PM2.
- The successful local build logged known local-database prerender diagnostics because `prisma/dev.db` lacks `DiscountCode` and `Category`; these did not fail compilation or static generation and are outside this fix scope.
