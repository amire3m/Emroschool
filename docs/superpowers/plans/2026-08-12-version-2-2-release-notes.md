# Version 2.2 Release Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish version 2.2.0 in the admin update timeline with one release card and 18 user-facing capability cards dated from their actual delivery commits.

**Architecture:** Keep the existing static `lib/version.ts` data source and `/admin/updates` renderer. Add a focused contract test that validates version consistency, approved card coverage, IDs, timestamps, copy, types, and descending export order without introducing a database or editing UI.

**Tech Stack:** TypeScript, Next.js 14 App Router, Node test runner through `tsx --test`, existing `ReleaseNote` interface.

## Global Constraints

- Set `APP_VERSION` exactly to `2.2.0`.
- Add exactly one `version-2-2` release card and the 18 approved capability cards from the design specification.
- Group follow-up fixes and hardening under their user-facing capability card; do not create one card per commit.
- Preserve the existing `/admin/updates` layout and `releaseNotes` newest-first sorting behavior.
- Do not add a database model, update editor, public changelog, notification, or navigation item.
- Use ISO 8601 timestamps with an explicit timezone offset; capability timestamps must match the approved specification.
- Use the approved version 2.2 publication timestamp `2026-08-12T11:51:01+03:30` for the release card.
- Preserve unrelated working-tree changes and stage only files named by this plan.

---

### Task 1: Version 2.2 Release-Note Contract And Data

**Files:**
- Create: `tests/version-release-notes.test.ts`
- Modify: `lib/version.ts:1-12`
- Modify: `lib/version.ts:12-407`

**Interfaces:**
- Consumes: existing `ReleaseNote`, `APP_VERSION`, and sorted `releaseNotes` exports from `lib/version.ts`.
- Produces: `APP_VERSION = "2.2.0"` and the approved version 2.2 release-note entries for the existing admin dashboard and update timeline.

- [ ] **Step 1: Write the failing release-note contract test**

Create `tests/version-release-notes.test.ts` with these assertions:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { APP_VERSION, releaseNotes } from "../lib/version";

const approvedCapabilityIds = [
  "local-iran-location-data",
  "protected-course-curriculum",
  "reliable-bale-payments",
  "search-indexing-and-course-ssr",
  "homepage-registration-path",
  "payer-card-security",
  "organized-user-files",
  "admin-dashboard-reports",
  "google-account-onboarding",
  "multi-step-registration",
  "homepage-performance-accessibility",
  "change-payment-method",
  "admin-user-management-history",
  "support-ticket-system",
  "profile-review-workflow",
  "registration-result-notification",
  "standalone-discount-codes",
  "pending-application-review",
] as const;

test("publishes the complete version 2.2 update set", () => {
  assert.equal(APP_VERSION, "2.2.0");

  const releaseCards = releaseNotes.filter((note) => note.id === "version-2-2");
  assert.equal(releaseCards.length, 1);
  assert.equal(releaseCards[0].type, "release");
  assert.equal(releaseCards[0].version, APP_VERSION);

  for (const id of approvedCapabilityIds) {
    assert.equal(releaseNotes.filter((note) => note.id === id).length, 1, id);
  }
});

test("keeps release notes valid, unique, and sorted newest first", () => {
  const ids = releaseNotes.map((note) => note.id);
  assert.equal(new Set(ids).size, ids.length);

  const allowedTypes = new Set(["release", "feature", "improvement", "fix"]);
  for (const note of releaseNotes) {
    assert.equal(note.id.trim(), note.id);
    assert.notEqual(note.title.trim(), "");
    assert.notEqual(note.summary.trim(), "");
    assert.equal(allowedTypes.has(note.type), true, note.id);
    assert.match(note.publishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
    assert.equal(Number.isNaN(Date.parse(note.publishedAt)), false, note.id);
  }

  for (let index = 1; index < releaseNotes.length; index += 1) {
    assert.ok(
      Date.parse(releaseNotes[index - 1].publishedAt) >=
        Date.parse(releaseNotes[index].publishedAt),
      `${releaseNotes[index - 1].id} must not precede ${releaseNotes[index].id}`,
    );
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --require ./tests/server-only-test-register.cjs --test tests/version-release-notes.test.ts`

Expected: FAIL because `APP_VERSION` is still `2.1.0` and `version-2-2` plus the 18 approved capability IDs do not exist.

- [ ] **Step 3: Add the release and capability cards**

In `lib/version.ts`, set:

```ts
export const APP_VERSION = "2.2.0";
```

Prepend 19 objects to `unsortedReleaseNotes` using the exact IDs, types, and capability timestamps in `docs/superpowers/specs/2026-08-12-version-2-2-release-notes-design.md`. Use concise Persian titles and summaries that communicate these approved meanings:

```ts
{
  id: "version-2-2",
  title: "انتشار نسخه ۲.۲ سامانه",
  summary: "نسخه ۲.۲ با پرداخت پایدار بله، سرفصل امن دوره‌ها، ثبت‌نام و پشتیبانی کامل‌تر، گزارش‌های مدیریتی، بهبود سرعت و دسترس‌پذیری و اطلاعات محلی استان‌ها و شهرها منتشر شد.",
  publishedAt: "2026-08-12T11:51:01+03:30",
  version: APP_VERSION,
  type: "release",
},
```

Use these approved capability timestamps without alteration:

```text
local-iran-location-data             2026-08-12T03:17:02+03:30 fix
protected-course-curriculum          2026-08-11T12:31:09+03:30 feature
reliable-bale-payments               2026-08-11T02:28:01+03:30 improvement
search-indexing-and-course-ssr       2026-08-10T02:02:19+03:30 improvement
homepage-registration-path           2026-08-10T01:31:24+03:30 improvement
payer-card-security                  2026-08-08T04:21:36+03:30 feature
organized-user-files                 2026-08-08T03:23:47+03:30 improvement
admin-dashboard-reports              2026-08-08T03:04:05+03:30 feature
google-account-onboarding            2026-08-08T02:25:57+03:30 improvement
multi-step-registration              2026-08-08T01:22:36+03:30 feature
homepage-performance-accessibility   2026-08-07T19:10:03+03:30 improvement
change-payment-method                2026-08-07T13:41:03+03:30 feature
admin-user-management-history        2026-08-04T19:34:30+03:30 feature
support-ticket-system                2026-08-04T18:07:23+03:30 feature
profile-review-workflow              2026-08-04T17:39:36+03:30 feature
registration-result-notification     2026-08-03T16:51:44+03:30 improvement
standalone-discount-codes            2026-08-03T15:49:41+03:30 feature
pending-application-review           2026-08-03T14:51:33+03:30 improvement
```

Do not modify the `ReleaseNote` interface, sorting expression, or existing historical cards.

- [ ] **Step 4: Run focused and full verification sequentially**

Run:

```bash
npx tsx --require ./tests/server-only-test-register.cjs --test tests/version-release-notes.test.ts
npm test
npx tsc --noEmit --incremental false
npm run build
git diff --check
```

Expected: focused tests PASS, full suite PASS with no failures, TypeScript exits 0, Next.js production build exits 0, and `git diff --check` prints no diagnostics.

- [ ] **Step 5: Review scope and commit implementation**

Inspect `git status`, `git diff -- lib/version.ts tests/version-release-notes.test.ts`, and recent commits. Stage only the implementation files:

```bash
git add -- lib/version.ts tests/version-release-notes.test.ts
git commit -m "feat: publish version 2.2 release notes"
```

Expected: unrelated changes in `app/api/alumni/route.ts`, `tsconfig.tsbuildinfo`, event layouts, and `skill-observations/` remain unstaged.

---

### Task 2: Release Integration And Production Verification

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: committed `APP_VERSION`, `releaseNotes`, existing admin dashboard, existing update timeline, and `/var/www/Emroschool/deploy-safe.sh`.
- Produces: version 2.2.0 displayed on production with the complete newest-first update history.

- [ ] **Step 1: Inspect the release before push**

Run:

```bash
git status --short --branch
git diff origin/master..HEAD --stat
git diff --check origin/master..HEAD
git log --oneline --decorate -10
```

Confirm the branch contains only the approved specification, plan, release-note implementation, and contract test beyond `origin/master`. Confirm unrelated local files are not committed.

- [ ] **Step 2: Push master**

Run: `git push origin master`

Expected: `origin/master` advances to the release-note implementation commit without force push.

- [ ] **Step 3: Deploy with the reviewed server script**

Connect to the pinned VPS host and run:

```bash
bash /var/www/Emroschool/deploy-safe.sh
```

If tracked server drift blocks the fast-forward, inspect it first. Preserve unrelated drift in a named stash rather than discarding it, leave untracked production files untouched, and rerun the script only after the tracked tree is clean.

- [ ] **Step 4: Verify production commit and process health**

On the VPS, assert:

```bash
cd /var/www/Emroschool
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain --untracked-files=no
pm2 show emroschool
```

Expected: local and remote commits match, tracked status is clean, and `emroschool` is online with zero unstable restarts.

- [ ] **Step 5: Verify rendered version and release-note data**

Use an authenticated admin session or a server-side import probe to assert:

- `APP_VERSION` is `2.2.0`.
- `version-2-2` is the newest card and references version `2.2.0`.
- All 18 approved capability IDs exist exactly once.
- `/admin` and `/admin/updates` return HTTP `200` for an authorized admin.
- The dashboard shows the latest three update cards and the timeline renders all cards newest first.

Do not create or alter production data for this static-content verification.

- [ ] **Step 6: Check fresh production logs**

Record the PM2 error-log byte count, request `/admin` and `/admin/updates` through the authorized verification path, then confirm the byte count did not grow. Check recent Nginx entries for relevant `500` or `502` responses and distinguish unrelated bot traffic by route.

- [ ] **Step 7: Record completion evidence**

Report the deployed commit, version, card count, PM2 state, HTTP results, backup path emitted by `deploy-safe.sh`, and any deliberately skipped verification. Do not repeat SSH credentials in logs or responses.
