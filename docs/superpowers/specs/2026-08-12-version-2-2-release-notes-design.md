# Version 2.2 Release Notes Design

## Goal

Complete the admin update history after the last existing entry on 2026-08-03, group related implementation commits into user-facing capability cards, and publish the current system as version 2.2.0.

## Scope

- Change `APP_VERSION` from `2.1.0` to `2.2.0`.
- Add one release card and 18 capability cards to `lib/version.ts`.
- Add an automated contract test for the release-note collection.
- Preserve the existing `/admin/updates` page layout and sorting behavior.
- Do not add a database model, update editor, public changelog, notification, or new navigation item.
- Preserve unrelated working-tree changes.

## Editorial Model

Each card describes one user-visible capability rather than one Git commit. Follow-up fixes, hardening, and refactors that complete the same capability are summarized in that capability's card instead of creating technical duplicate entries.

Use the timestamp of the commit that first delivered the capability, except where a later commit is necessary for the capability to be complete and safely usable. The version-release card uses the approved publication timestamp `2026-08-12T11:51:01+03:30`. All timestamps use ISO 8601 with the Iran `+03:30` offset.

Cards remain in `unsortedReleaseNotes`; the existing exported sort continues to place newest entries first.

## Release Cards

The following cards will be added. Final Persian copy may be tightened during implementation without changing meaning or scope.

| ID | Type | Published at | Title | Required meaning |
| --- | --- | --- | --- | --- |
| `version-2-2` | `release` | `2026-08-12T11:51:01+03:30` | انتشار نسخه ۲.۲ سامانه | Summarize the reliability, course-management, registration, support, reporting, performance, and location improvements in version 2.2.0. Set `version` to `2.2.0`. |
| `local-iran-location-data` | `fix` | `2026-08-12T03:17:02+03:30` | اطلاعات محلی استان‌ها و شهرها | Province, city, and Tehran district data are served locally; Tehran selection no longer crashes; Tehran neighborhood is entered as required text. |
| `protected-course-curriculum` | `feature` | `2026-08-11T12:31:09+03:30` | مدیریت و نمایش سرفصل دوره‌ها | Admins can manage ordered chapters and lessons; enrolled users and admins can see details while locked users receive only a safe summary. |
| `reliable-bale-payments` | `improvement` | `2026-08-11T02:28:01+03:30` | پرداخت پایدار با بله | Cover server-owned attempts, countdown and expiry, safe retry/restart, webhook finalization, preservation of uncertain evidence, and authorized admin reconciliation. |
| `search-indexing-and-course-ssr` | `improvement` | `2026-08-10T02:02:19+03:30` | بهبود ایندکس و نمایش دوره‌ها در جستجو | Consolidate canonical signals and render meaningful course content for crawlers. |
| `homepage-registration-path` | `improvement` | `2026-08-10T01:31:24+03:30` | مسیر روشن ثبت‌نام در صفحه اصلی | Place the registration journey near the hero and improve the homepage conversion path. |
| `payer-card-security` | `feature` | `2026-08-08T04:21:36+03:30` | ثبت امن کارت پرداخت‌کننده | Collect payer card information for transfers, validate it, protect it at rest, and expose it only to authorized payment admins. |
| `organized-user-files` | `improvement` | `2026-08-08T03:23:47+03:30` | سامان‌دهی فایل‌های کاربران و رسیدها | Separate profile files, payment receipts, and user-owned uploads in file management. |
| `admin-dashboard-reports` | `feature` | `2026-08-08T03:04:05+03:30` | گزارش‌های مدیریتی داشبورد | Add operational reporting to the admin dashboard. |
| `google-account-onboarding` | `improvement` | `2026-08-08T02:25:57+03:30` | تکمیل اطلاعات پس از ورود با گوگل | Require users created through Google sign-in to complete required registration information before continuing. |
| `multi-step-registration` | `feature` | `2026-08-08T01:22:36+03:30` | ثبت‌نام چندمرحله‌ای | Split account creation, verification, and completion into a clear multi-step flow while retaining returning-user fields. |
| `homepage-performance-accessibility` | `improvement` | `2026-08-07T19:10:03+03:30` | سرعت و دسترس‌پذیری بهتر صفحه اصلی | Defer noncritical work, improve mobile loading, and complete semantic and asset accessibility fixes. |
| `change-payment-method` | `feature` | `2026-08-07T13:41:03+03:30` | تغییر روش پرداخت | Allow users to switch safely between supported payment methods and keep admin payment state consistent. |
| `admin-user-management-history` | `feature` | `2026-08-04T19:34:30+03:30` | مدیریت کامل کاربران و ثبت‌نام دستی | Combine complete user editing, course and discount history, and manual enrollment controls. |
| `support-ticket-system` | `feature` | `2026-08-04T18:07:23+03:30` | سامانه تیکت پشتیبانی | Users can open and follow support tickets; admins can reply and manage ticket status. |
| `profile-review-workflow` | `feature` | `2026-08-04T17:39:36+03:30` | بررسی پروفایل و تصویر کاربران | Admins can preview, approve, reject, and correct profile/avatar review decisions. |
| `registration-result-notification` | `improvement` | `2026-08-03T16:51:44+03:30` | اعلان نتیجه ثبت‌نام دوره | Notify users when their course registration is received and processed. |
| `standalone-discount-codes` | `feature` | `2026-08-03T15:49:41+03:30` | کدهای تخفیف مستقل | Create and validate discount codes that are not tied to only one course. |
| `pending-application-review` | `improvement` | `2026-08-03T14:51:33+03:30` | وضعیت در انتظار بررسی درخواست‌ها | New applications remain pending until admin review instead of appearing prematurely approved or payable. |

## Data Contract

`ReleaseNote` remains unchanged:

```ts
interface ReleaseNote {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  version?: string;
  type: "release" | "feature" | "improvement" | "fix";
}
```

The release card references `APP_VERSION` for its `version` field so the page heading and current release card cannot diverge. Historical cards keep explicit historical versions where already present.

## Validation And Testing

Add a focused test that imports `APP_VERSION` and `releaseNotes` and asserts:

- `APP_VERSION` equals `2.2.0`.
- Exactly one `version-2-2` card exists and its version equals `APP_VERSION`.
- Every release-note ID is unique.
- Every timestamp is valid and includes an explicit timezone offset.
- Exported notes are sorted newest first.
- All 18 approved capability IDs are present exactly once.
- Titles and summaries are non-empty after trimming.
- Types belong to the documented union.

Run the focused test, full test suite, TypeScript check, production build, and `git diff --check` before publishing.

## Deployment And Verification

Commit only the specification, implementation, and test files. Push `master`, run `/var/www/Emroschool/deploy-safe.sh`, and verify:

- Production commit matches `origin/master`.
- PM2 reports `emroschool` online.
- `/admin` reports version 2.2.0 and shows the newest cards.
- `/admin/updates` renders the full timeline in descending date order.
- No new PM2 errors occur during these requests.

Authenticated visual verification may use an existing admin session. Do not create or alter production user data solely to verify static release-note rendering.
