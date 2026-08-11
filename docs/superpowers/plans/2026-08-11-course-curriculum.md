# Course Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ordered course chapters and lessons that administrators manage and only enrolled users can read, while visitors receive a title-free locked summary.

**Architecture:** Store chapters and lessons in normalized Prisma relations with stable IDs and parent-scoped ordering. Reconcile nested writes transactionally through a focused curriculum service. Serialize course detail through one access-aware boundary so admin/enrolled responses contain titles and anonymous/non-enrolled/SSR responses contain summary counts only.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5 with SQLite, React 18, Tailwind CSS, Node test runner through `tsx --test`.

## Global Constraints

- Chapter title and lesson title are required after trimming.
- Lesson duration is optional; when present it is a positive integer number of minutes.
- Existing courses with no curriculum remain valid and render no curriculum section.
- Course collection responses and exports never include curriculum rows.
- Full titles are returned only to course admins or users enrolled in that exact course.
- Anonymous, SSR, and authenticated non-enrolled responses contain summary counts only and cannot serialize restricted titles.
- Ordering is gapless and server-normalized; the browser does not control persisted order values.
- Curriculum writes preserve owned IDs, reject foreign IDs, delete omitted records, and update the parent course timestamp atomically.
- UI remains RTL, responsive, keyboard accessible, consistent with the incumbent visual system, and uses up/down controls rather than drag-and-drop.
- Do not add video, files, descriptions, lesson completion, previews, scheduling, or child-course hierarchy changes.

---

### Task 1: Curriculum Domain And Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/course-curriculum.ts`
- Create: `tests/course-curriculum-domain.test.ts`

**Interfaces:**
- Produces: `CurriculumInput`, `normalizeCurriculum(input)`, `curriculumSummary(chapters)`, and Prisma models `CourseChapter` / `CourseLesson`.
- `normalizeCurriculum` returns ordered chapters with ordered lessons and normalized `order` values starting at zero.

- [ ] Write failing tests for trimmed required titles, optional positive integer minutes, duplicate/foreign-shaped IDs, gapless chapter/lesson order, empty curriculum, and summary totals.
- [ ] Run `npx tsx --test tests/course-curriculum-domain.test.ts`; verify failure because the module/models do not exist.
- [ ] Add `CourseChapter` and `CourseLesson` with cascade relations, timestamps, parent indexes, and integer order; add `chapters` relation to `Course`.
- [ ] Implement strict normalization that accepts only plain arrays/objects and returns `{ id?, title, order, lessons: [{ id?, title, durationMinutes, order }] }`.
- [ ] Run the focused test, `npx prisma validate`, and `npx prisma generate` sequentially.
- [ ] Commit with `feat: model course curriculum`.

### Task 2: Transactional Curriculum Persistence

**Files:**
- Modify: `lib/course-curriculum.ts`
- Modify: `app/api/courses/route.ts`
- Modify: `app/api/courses/[id]/route.ts`
- Create: `tests/course-curriculum-persistence.test.ts`

**Interfaces:**
- Consumes: `normalizeCurriculum` and Prisma transaction client.
- Produces: `syncCourseCurriculum(tx, courseId, curriculum)` and course create/update support for `curriculum` payload.

- [ ] Write failing tests using real temporary SQLite for nested create, stable-ID update, omitted-row deletion, cascade deletion, foreign chapter/lesson rejection, rollback, gapless reorder, and parent `updatedAt` change.
- [ ] Run the focused persistence test and confirm it fails before implementation.
- [ ] Implement `syncCourseCurriculum` to load all owned IDs, reject any supplied ID outside the course, update/create in input order, delete omitted lessons/chapters, and touch the parent in one transaction.
- [ ] Wrap course POST and PUT plus curriculum synchronization in a single retry-safe Prisma transaction; return Persian 400 for validation and 409 for foreign IDs.
- [ ] Keep collection GET unchanged and curriculum-free.
- [ ] Run focused tests and full `npm test`.
- [ ] Commit with `feat: save course curriculum atomically`.

### Task 3: Access-Aware Course Detail Serialization

**Files:**
- Modify: `lib/course-curriculum.ts`
- Modify: `app/api/courses/[id]/route.ts`
- Modify: `app/(site)/courses/[slug]/layout.tsx`
- Create: `tests/course-curriculum-access.test.ts`

**Interfaces:**
- Produces: `serializeCurriculum({ chapters, canReadTitles })` returning `{ curriculumLocked, curriculumSummary, curriculum? }`.
- Full curriculum is ordered and present only when `canReadTitles` is true.

- [ ] Write failing tests for admin, enrolled user, authenticated non-enrolled user, anonymous API, and SSR initial data; inject distinctive secret titles and assert they are absent from locked JSON.
- [ ] Run the focused access test and verify failure.
- [ ] Extend item GET authorization to calculate `canReadTitles` from existing admin auth or an exact `Enrollment(userId, courseId)` lookup.
- [ ] Query chapters only in item-detail/SSR paths; return summary to everyone and strip titles for locked callers at the serializer boundary.
- [ ] Keep SSR locked and title-free because request cookies are not a trusted enrollment data source in the current layout.
- [ ] Add curriculum summary counts to detail data without changing collection queries, exports, metadata, JSON-LD, or sitemap content.
- [ ] Run focused tests, full tests, and grep rendered/serialized fixtures for secret titles.
- [ ] Commit with `feat: protect enrolled course curriculum`.

### Task 4: Admin Curriculum Editor

**Files:**
- Create: `components/admin/course-curriculum-editor.tsx`
- Modify: `app/admin/courses/page.tsx`
- Create: `tests/course-curriculum-editor.test.ts`

**Interfaces:**
- Consumes: normalized `CurriculumInput` shape.
- Produces: controlled `CourseCurriculumEditor({ value, onChange, disabled })` and pure reorder/add/remove helpers.

- [ ] Write failing helper tests for adding/removing chapters and lessons, moving first/last items safely, preserving stable IDs, and normalizing minute input.
- [ ] Run focused tests and verify failure.
- [ ] Build a focused Operate-mode editor with chapter cards, lesson rows, explicit labels, empty state, up/down controls, delete confirmation, and optional numeric minutes.
- [ ] Add curriculum to admin form defaults/payload; fetch item detail before opening edit so collection GET stays lightweight.
- [ ] Preserve unsaved editor state when save fails and show the API's Persian error.
- [ ] Verify keyboard operation, focus visibility, mobile stacking, long Persian titles, 0 chapters, and at least 20 chapters / 50 lessons.
- [ ] Run detector once: `node C:\Users\Novin\.config\opencode\skills\impeccable\scripts\detect.mjs --json components/admin/course-curriculum-editor.tsx app/admin/courses/page.tsx`.
- [ ] Run focused/full tests, TypeScript, and production build.
- [ ] Commit with `feat: add curriculum course editor`.

### Task 5: Enrolled And Locked Public Curriculum

**Files:**
- Create: `components/courses/course-curriculum.tsx`
- Modify: `app/(site)/courses/[slug]/page.tsx`
- Create: `tests/course-curriculum-view.test.ts`

**Interfaces:**
- Consumes: `{ curriculumLocked, curriculumSummary, curriculum? }` from Task 3.
- Produces: locked summary card or enrolled accordion with no rendering for zero chapters.

- [ ] Write failing view-model tests for zero curriculum, locked summary, enrolled ordered chapters, duration formatting, and no-title locked props.
- [ ] Run focused tests and verify failure.
- [ ] Implement an accessible RTL accordion using native buttons, `aria-expanded`, `aria-controls`, numbered chapters/lessons, and Persian duration formatting.
- [ ] Implement the locked card with chapter/lesson counts, total duration, lock explanation, and existing registration action; never accept hidden titles as locked props.
- [ ] Place the section after course overview and before registration/sidebar content without duplicating existing comprehensive-course child paths.
- [ ] Check desktop/mobile, keyboard, long titles, reduced motion, empty state, enrolled loading transition, and locked state.
- [ ] Run detector once over changed public targets, then focused/full tests, TypeScript, and production build.
- [ ] Commit with `feat: show protected course curriculum`.

### Task 6: Production Migration And Verification

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: existing `deploy-safe.sh` database backup/schema push/build/restart flow.
- Produces: production schema, healthy PM2 process, and verified curriculum access boundaries.

- [ ] Inspect status, complete diff, recent commits, and ensure unrelated local files remain unstaged.
- [ ] Run fresh `npm test`, `npx prisma validate`, `npx tsc --noEmit --incremental false`, `npm run build`, and `git diff --check` sequentially.
- [ ] Push `master` and execute `/var/www/Emroschool/deploy-safe.sh`.
- [ ] Verify production commit and PM2 online state.
- [ ] Create a temporary curriculum on a non-production-critical test course or transactionally seed/clean a dedicated fixture; verify admin detail contains titles, enrolled detail contains titles, anonymous/non-enrolled detail contains summary only, and collection GET contains no curriculum.
- [ ] Verify existing courses with no chapters still return and render successfully.
- [ ] Remove the verification fixture and confirm no restricted title remains in anonymous API responses or page HTML.
