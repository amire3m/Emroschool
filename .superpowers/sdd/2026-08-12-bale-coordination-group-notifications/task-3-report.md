# Task 3 Report

## Status

Implemented deployment-time Bale release reconciliation, an immediate locked dispatch, and idempotent root Cron installation. Production access and execution were deliberately not performed.

## TDD Evidence

### RED

Command:

`npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts`

Result: exit 1, 7 tests, 5 passed, 2 failed.

- `deployment reconciles and dispatches only after a successful build and restart` failed because reconciliation and dispatch commands were absent.
- `deployment installs an idempotent secret-free root cron using absolute paths and the dispatch lock` failed with `ENOENT` because the Cron file was absent.

### GREEN

Focused command:

`npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts`

Final result: exit 0, 8 tests, 8 passed, 0 failed, duration 9756.9139 ms.

## Implementation

- Runs `npm run bale:reconcile-releases` only after schema push, backfill, build, and successful PM2 restart.
- Resolves absolute `npm`, `flock`, and `bash` paths during deployment.
- Loads the existing app `.env` inside the dispatch shell with automatic export, without copying secret values into Cron.
- Uses one lock file for the blocking immediate dispatch and non-blocking minute Cron dispatch.
- Suppresses routine Cron JSON stdout and appends stderr to a stable log.
- Creates lock and log files for the app directory owner, then installs `/etc/cron.d/emroschool-bale-notifications` through a same-directory temporary file and atomic move.
- Treats reconciliation, immediate dispatch, and Cron setup failures as deployment failures after PM2 is online. This reports notification failures without stopping or rolling back the healthy restarted app.

## Sequential Verification

1. `npm test`
   Exit 0. 234 tests, 234 passed, 0 failed, 0 skipped. Duration 10430.2735 ms.
2. `npx tsc --noEmit --incremental false`
   Exit 0. No output.
3. `npm run build`
   Exit 0. Next.js compiled, type-checked, generated 99/99 static pages, finalized optimization, and collected traces. Known Prisma P2021 fixture diagnostics appeared for missing `DiscountCode` and `Category` tables.
4. `git diff --check`
   Exit 0. No whitespace errors. Git emitted only LF-to-CRLF working-copy warnings for the two task files.

## Self-Review

- Confirmed exact package scripts: `bale:reconcile-releases` and `bale:dispatch-group-events`.
- Confirmed reconciliation and immediate dispatch occur after successful restart and never run on build failure.
- Confirmed Cron content is stable across repeat deployments, uses root-Cron user syntax, absolute executables, app working directory, shared lock, and no embedded fixture secrets.
- Confirmed Cron installation failure exits nonzero after PM2 restart and does not trigger another stop/restart transition.
- Confirmed immediate dispatch blocks on the shared lock before Cron replacement, avoiding overlap with a pre-existing Cron invocation while guaranteeing the requested immediate attempt.
- Confirmed only `deploy-safe.sh` and `tests/deploy-safe.test.ts` are intended for the commit; pre-existing `tsconfig.tsbuildinfo` remains unstaged.

## Commit

`45bd4a2 feat: schedule Bale notification dispatch`

## Production-Only Steps Remaining

- Integrate the branch and explicitly obtain production environment access.
- Configure `BALE_BOT_TOKEN` and `BALE_COORDINATION_CHAT_ID` in the existing production `.env` without printing either value.
- Run the production schema/deploy flow as root or with permission to manage `/etc/cron.d`, `/var/lock`, and `/var/log`.
- Verify the Cron file, app user, resolved executable paths, lock/log ownership, and PM2 online state.
- Confirm version 2.2 is sent once, its durable event status is `sent`, and notification/PM2 logs contain no sensitive content or unexpected errors.

## Review Fix Round 1

### Findings Addressed

- Replaced shell sourcing of `.env` with `scripts/load-bale-app-env.cjs`, which uses the directly declared `@next/env` dependency and `loadEnvConfig` to parse the application environment without evaluating dotenv bytes as shell code.
- Removed Bash and npm from the generated Cron command. Deployment resolves the actual Node binary through `APP_USER`, then Cron invokes absolute Node, local `tsx`, loader, and dispatcher paths directly.
- Runs reconciliation and immediate dispatch through `runuser` as `APP_USER` with `env -i`, preventing root/deployment environment leakage. Root Cron performs minute dispatch as the same user.
- Validates the Cron username syntax and verifies the account exists before PM2 is stopped.
- Requires absolute app, Cron, lock, and log paths; canonicalizes existing directories and executable paths; rejects newline and `%` Cron syntax injection.
- Executes the generated Cron command under a minimal environment in tests and verifies non-blocking `flock`, the shared lock path, absolute runtime, and dispatcher invocation.
- Acquires the shared lock before deployment mutation. The old Cron remains intact through backup-safe failures, is removed at the restart-unsafe transition, and remains disabled if post-restart notification setup fails. PM2 remains online after a post-restart notification failure.

### RED Evidence

Command:

`npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`

Initial result: exit 1, 12 tests, 5 passed, 7 failed.

- Safe dotenv loader failed with `MODULE_NOT_FOUND` because no application-aware loader existed.
- Reconcile/app-user ordering failed because deployment still used root-context npm.
- Cron execution failed the no-Bash/no-npm/no-shell-dotenv contract.
- Unsafe username/path configuration was accepted.
- Non-canonical `APP_DIR` remained embedded in Cron.
- An old Cron remained installed after post-restart notification setup failure.

Additional RED regressions were proven after self-review:

- Immediate app-user execution inherited `DEPLOY_ONLY_SECRET` from root.
- A syntactically valid nonexistent `APP_USER` was accepted.
- Backup failure removed an otherwise valid old Cron before the restart-unsafe transition.

### Focused Verification

1. `npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`
   Exit 0. 13 tests, 13 passed, 0 failed. Duration 23610.9667 ms.
2. `npx tsx --require ./tests/server-only-test-register.cjs --test tests/bale-group-dispatcher.test.ts`
   Exit 0. 17 tests, 17 passed, 0 failed. Duration 315.3906 ms.

### Final Sequential Verification

1. `npm test`
   Exit 0. 239 tests, 239 passed, 0 failed, 0 skipped. Duration 25561.0131 ms.
2. `npx tsc --noEmit --incremental false`
   Exit 0. No output.
3. `npm run build`
   Exit 0. Next.js compiled, type-checked, generated 99/99 static pages, finalized optimization, and collected traces. Known Prisma P2021 fixture diagnostics appeared for missing `DiscountCode` and `Category` tables.
4. `git diff --check`
   Exit 0. No whitespace errors. Git emitted only LF-to-CRLF working-copy warnings for `deploy-safe.sh`, `package.json`, and `tests/deploy-safe.test.ts`.

### Review Fix Self-Review

- Generated Cron contains paths and `BALE_APP_DIR` only; no token, chat ID, or parsed dotenv value is embedded.
- Malicious dotenv syntax remains literal and cannot create the marker file in the regression test.
- Both immediate and minute dispatch use the same canonical lock file; immediate deployment holds the lock continuously across code mutation, reconciliation, dispatch, and atomic Cron replacement.
- Pre-restart PM2 safety behavior is preserved. Post-restart notification failure returns nonzero with PM2 online and no old Cron dispatching against new code.
- New runtime resolution occurs after pull/install/build so the deployment that introduces the loader can bootstrap successfully.
- `tsconfig.tsbuildinfo` remains excluded from staging and commit.

### Fix Round 3 Commit

`ae9a3de fix: isolate Bale deployment lock`

### Fix Round 2 Commit

`e68fce2 fix: secure Bale notification state`

## Fix Round 3

### Lock Lifetime Change

- Replaced Bash-owned numeric-FD locking with a util-linux command wrapper: `flock --close <shared-lock> ... deploy-safe.sh`.
- The supervising `flock` process owns the exclusive lock for the entire reexecuted deployment critical section.
- Per util-linux `flock(1)`, `--close` closes the lock descriptor before executing the wrapped command, specifically preventing commands and their descendants from retaining it.
- The reexecuted deployment is marked with `BALE_DEPLOY_LOCKED=1`, so it does not reacquire the lock. Reconcile, immediate dispatch, and Cron replacement run directly while the supervisor owns the lock, avoiding self-deadlock.
- The supervisor releases the lock whenever the wrapped deploy exits, on both success and failure.
- The wrapper uses canonical absolute `flock`, Bash, lock-file, and deploy-script paths.

### RED Evidence

Command:

`npx tsx --require ./tests/server-only-test-register.cjs --test --test-name-pattern="deployment reconciles" tests/deploy-safe.test.ts`

Result: exit 1. The deploy integration test expected `flock --close ... notifications.lock ... deploy-safe.sh` but observed the old numeric-FD call `flock 10`.

The Linux-only actual-deploy tests were added first but skip on Windows. They run the real deploy script with real util-linux `flock`; one fake PM2 restart spawns a 30-second descendant, and both success and dispatcher-failure cases require an immediate subsequent `flock -n` acquisition to succeed.

### Focused Verification

1. `npx tsx --require ./tests/server-only-test-register.cjs --test --test-name-pattern="deployment reconciles|actual deploy releases" tests/deploy-safe.test.ts`
   Exit 0. Portable wrapper test passed; two actual-deploy tests skipped because this host is Windows.
2. `npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`
   Exit 0. 20 tests: 16 passed, 0 failed, 4 skipped. Duration 70461.8851 ms.

The four skips require Linux filesystem/util-linux behavior: symlink leaf rejection, basic real-flock contention, actual deploy release after a long-lived PM2 descendant, and actual deploy release after failure.

### Final Sequential Verification

1. `npm test`
   Exit 0. 246 tests: 242 passed, 0 failed, 4 skipped. Duration 108095.2984 ms.
2. `npx tsc --noEmit --incremental false`
   Exit 0. No output.
3. `npm run build`
   Exit 0. Next.js compiled, type-checked, generated 99/99 static pages, finalized optimization, and collected traces. Known Prisma P2021 fixture diagnostics appeared for missing `DiscountCode` and `Category` tables.
4. `git diff --check`
   Exit 0. No whitespace errors. Git emitted only LF-to-CRLF working-copy warnings for `deploy-safe.sh` and `tests/deploy-safe.test.ts`.

### Fix Round 3 Self-Review

- Lock ownership starts before backup/PM2/schema mutation and ends after reconciliation, immediate dispatch, and atomic Cron replacement.
- No deployment child receives the supervisor's locked descriptor; PM2/app descendants therefore cannot extend lock lifetime.
- Immediate dispatch does not invoke `flock` and cannot deadlock against its own deployment lock.
- Cron still uses nonblocking `flock` against the identical protected lock path.
- Exit status continues to propagate from the wrapped deploy through `flock`, preserving PM2 failure safety and deploy failure reporting.
- `tsconfig.tsbuildinfo` remains excluded from staging and commit.

### Review Fix Commit

`9eb7054 fix: harden Bale notification cron`

## Fix Round 2

### Security Changes

- Replaced configurable lock/log file paths with dedicated state directories and validated basenames. Production defaults are `/run/emroschool/notifications.lock` and `/var/log/emroschool/notifications.log`.
- Requires Cron, lock, and log parents to be absolute, canonical, non-symlink, root-owned directories with no group/world write bits.
- Creates missing dedicated directories as root-owned mode `0755` and verifies their non-following metadata after creation.
- Rejects `.`, `..`, slash, newline, percent, and other characters outside the basename allowlist.
- Rejects existing symlink and non-regular lock/log leaves. Existing files must be app-owned regular files with mode `0640`; missing files are created with `install` as the app user/group at mode `0640` inside non-app-writable parents.
- Removed root `touch`, `chown`, and `chmod` operations on configurable leaves, eliminating symlink dereference against attacker-selected files.
- Validates the Cron parent before temporary-file creation and atomic replacement.
- Completed old-Cron behavior: backup-safe failure preserves it; every restart-unsafe or post-restart failure disables it; success atomically replaces it.

### RED Evidence

Command:

`npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`

Initial result: exit 1, 17 tests, 3 passed, 13 failed, 1 skipped. Failures showed the old script still consumed file-path overrides, accepted unsafe leaves/basenames, lacked the full failure matrix, and did not establish the protected-directory contract.

Additional RED:

- Writable Cron parent regression initially passed deployment instead of rejecting before PM2 stop.
- PM2-restart failure fixture exposed and then corrected an independent fake-command fallthrough before the matrix proved the production behavior.

### Focused Verification

1. `npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`
   Exit 0. 18 tests: 16 passed, 0 failed, 2 skipped. Duration 46013.7754 ms.
2. `npx tsx --require ./tests/server-only-test-register.cjs --test --test-name-pattern="real flock" tests/deploy-safe.test.ts`
   Exit 0. The real contention test was discovered and skipped because Windows Git Bash has no real `flock` executable.
3. `bash -n deploy-safe.sh`
   Exit 0.

The two focused skips are Linux-specific: real symlink leaf behavior and real `flock` contention/lifetime. Both tests execute automatically where the required Linux primitives are available.

### Final Sequential Verification

1. `npm test`
   Exit 0. 244 tests: 242 passed, 0 failed, 2 skipped. Duration 45320.5347 ms.
2. `npx tsc --noEmit --incremental false`
   Exit 0. No output.
3. `npm run build`
   Exit 0. Next.js compiled, type-checked, generated 99/99 static pages, finalized optimization, and collected traces. Known Prisma P2021 fixture diagnostics appeared for missing `DiscountCode` and `Category` tables.
4. `git diff --check`
   Exit 0. No whitespace errors. Git emitted only LF-to-CRLF working-copy warnings for the three task files.

### Fix Round 2 Self-Review

- Parent ownership and modes prevent `APP_USER` from replacing lock/log directory entries between validation and use.
- Non-following `-L` checks reject symlink parents and leaves before any file mutation.
- `install` creates only missing leaves in protected parents; existing unexpected ownership, mode, or type fails deployment before PM2 stops.
- Shared lock lifetime covers code transition through reconciliation, immediate dispatch, and Cron replacement; the real contention test proves holder/contender behavior on environments with `flock`.
- Immediate execution clears deployment-only environment while the application loader provides dotenv values; generated Cron remains secret-free.
- `tsconfig.tsbuildinfo` remains excluded from staging and commit.

## Fix Round 4

### Lock-Scope Integration Test

- Replaced the completion-only Linux assertion with an asynchronous integration test that runs the actual `deploy-safe.sh` under real util-linux `flock`.
- The fake immediate dispatcher creates a ready marker and waits on a gate file after PM2 restart, deterministically pausing deployment inside the protected critical section.
- While dispatch is blocked, a nonblocking contender against the same lock must fail.
- Fake PM2 restart records a 300-second descendant PID; the test proves it is alive both while deployment is blocked and immediately after deployment exits.
- After releasing the gate, the test awaits successful deployment and requires immediate nonblocking lock acquisition while the PM2 descendant remains alive, then terminates that descendant in cleanup.
- The existing Linux failure-path integration test continues to require immediate lock acquisition after dispatch failure.

### RED Evidence

The prior Linux integration test awaited `runDeployment(fixture)` before its only lock probe. Code inspection showed it could not fail if the deployment lock were released before reconciliation or immediate dispatch, so it did not test complete critical-section scope. This Windows host has no WSL, Docker, Podman, or Linux util-linux runtime; the new Linux-only test therefore could not be executed here as a failing pre-change test. The new test is designed to fail on either relevant production mutation: early supervisor-lock release makes the blocked-section contender succeed, while removing `flock --close` leaves the lock inherited by the live PM2 descendant and makes the post-deployment acquisition fail.

### GREEN Evidence

1. `npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`
   Exit 0. 20 tests: 16 passed, 0 failed, 4 Linux-specific skipped. Duration 121239.4741 ms.
2. `bash -n deploy-safe.sh`
   Exit 0. No output.
3. `npm test`
   Exit 0. 246 tests: 242 passed, 0 failed, 4 Linux-specific skipped. Duration 114586.4973 ms.
4. `npx tsc --noEmit --incremental false`
   Exit 0. No output.
5. `npm run build`
   Exit 0. Next.js compiled, type-checked, generated 99/99 static pages, finalized optimization, and collected traces. Known Prisma P2021 fixture diagnostics appeared for missing `DiscountCode` and `Category` tables.
6. `git diff --check`
   Exit 0. No whitespace errors; Git emitted only the existing LF-to-CRLF warning for `tests/deploy-safe.test.ts`.

### Fix Commit

`77cf432 test: prove Bale deployment lock scope`

## Fix Round 5

### Bounded Deployment And Process Cleanup

- Added a 30-second timeout with `SIGKILL` to deployment subprocesses, keeping the deterministic dispatch gate well within a finite test bound.
- Linux lock-test cleanup now releases the dispatch gate before awaiting deployment and reads the PM2 descendant PID file independently both before and after that bounded await.
- PID-file cleanup accepts only canonical positive safe-integer PIDs, sends `SIGTERM` followed by `SIGKILL` when necessary, and ignores missing or malformed files rather than risking an arbitrary kill.
- Added portable helper regressions proving that a recorded long-lived process is terminated and malformed PID contents leave an unrelated live process untouched.

### TDD Evidence

The recorded-process helper regression first failed with `recorded process was not terminated` while the placeholder cleanup left its 300-second child alive. After implementing validated PID recovery and bounded termination, both helper regressions passed. The Linux-only lock behavior remains unavailable on this Windows host; its bounded marker polling and early-release/lock-inheritance mutation sensitivity are unchanged.

### Verification

1. `npx tsx --require ./tests/server-only-test-register.cjs --test tests/deploy-safe.test.ts tests/bale-group-env.test.ts`
   Exit 0. 22 tests: 18 passed, 0 failed, 4 platform-specific skipped. Duration 119998.7429 ms.
2. `"C:\\Program Files\\Git\\bin\\bash.exe" -n deploy-safe.sh`
   Exit 0. No output.
3. `npm test`
   Exit 0. 248 tests: 244 passed, 0 failed, 4 platform-specific skipped. Duration 93474.4882 ms.
4. `npx tsc --noEmit --incremental false`
   Exit 0. No output.
5. `npm run build`
   Exit 0. Next.js compiled, type-checked, generated 99/99 static pages, finalized optimization, and collected traces. Known Prisma P2021 fixture diagnostics appeared for missing `DiscountCode` and `Category` tables.
6. `git diff --check`
   Exit 0. No whitespace errors; Git emitted only the existing LF-to-CRLF warning for `tests/deploy-safe.test.ts`.

### Fix Commit

Included in the Fix Round 5 commit.
