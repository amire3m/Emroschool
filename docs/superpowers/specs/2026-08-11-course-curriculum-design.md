# Course Curriculum Design

## Goal

Add an ordered chapter-and-lesson curriculum to every course. Administrators can manage it from the course editor, enrolled users can read it on the course page, and visitors see only a locked summary without curriculum titles.

## Data Model

`CourseChapter` belongs to one `Course` and contains an ID, required title, integer order, creation time, and update time. `CourseLesson` belongs to one chapter and contains an ID, required title, optional positive duration in minutes, integer order, creation time, and update time.

Deleting a course cascades to its chapters and lessons. Deleting a chapter cascades to its lessons. Existing courses remain valid with no chapters. Orders are gapless and scoped to their parent.

## Administration

The existing course create/edit modal gains a curriculum section. Administrators can:

- Add, rename, remove, and move chapters up or down.
- Add, rename, remove, and move lessons within a chapter up or down.
- Enter an optional duration in minutes for each lesson.

Curriculum data is managed as local form state and saved with the course. Creation and update reconcile the full nested structure transactionally. Existing chapter and lesson IDs are preserved when supplied and owned by the edited course; omitted records are deleted. Foreign IDs are rejected. Titles are trimmed and required, durations must be positive integers when present, and ordering is normalized server-side rather than trusted from the browser.

Editing curriculum also touches the parent course `updatedAt`. The admin collection endpoint remains lightweight. Opening edit fetches the item-detail endpoint so the modal receives the complete curriculum only when needed.

## Access Control And API

Course collection responses never include curriculum rows.

Course detail responses always include a public `curriculumSummary` containing chapter count, lesson count, and total duration. Full chapter and lesson titles are included only when the requester is:

- An administrator with existing course-management access, or
- Authenticated and enrolled in that course.

All other requesters receive `curriculumLocked: true` and no chapter or lesson titles. This rule applies equally to unauthenticated users, authenticated non-enrolled users, server-rendered initial data, and API responses.

Course creation and update remain admin-only. Curriculum writes happen only through those existing protected course endpoints and are validated again on the server.

## Public Course Experience

For an enrolled user, the course detail page shows a curriculum section after the main course overview and before the registration/sidebar area. Chapters appear as numbered accordion rows in their saved order. Expanding a chapter reveals numbered lessons with their optional duration formatted in Persian.

For a visitor or non-enrolled user, the same location shows a locked card with chapter count, lesson count, total duration when available, and the existing registration action. No restricted titles are rendered into HTML, serialized initial data, or client API payloads.

Courses with zero chapters do not show a curriculum section or locked card.

The section preserves the incumbent visual system, RTL behavior, responsive layout, keyboard interaction, visible focus states, and reduced-motion preferences.

## SEO And Data Boundaries

Restricted chapter and lesson titles are excluded from metadata, JSON-LD, sitemap output, collection APIs, and exports. Curriculum changes update the parent course timestamp so sitemap freshness remains accurate without exposing the restricted content.

## Error Handling

Invalid nested payloads return a Persian `400` response without partially changing the course or curriculum. IDs belonging to another course return a conflict response. Unauthorized reads never distinguish whether hidden curriculum titles exist beyond the allowed summary counts. Failed admin saves retain the local editor state and show the server message.

## Testing

Tests cover:

- Legacy courses with no curriculum.
- Admin-only nested create and update.
- Required titles and duration validation.
- Stable IDs, deletion of omitted records, cascade deletion, and gapless ordering.
- Transaction rollback when any nested write fails.
- Rejection of foreign chapter or lesson IDs.
- Collection response non-expansion.
- Detail access for admin, enrolled user, non-enrolled user, and anonymous SSR.
- Absence of restricted titles from locked JSON and initial HTML data.
- Summary counts and total duration.
- Parent `updatedAt` changes after curriculum writes.
- Public and admin rendering states, reorder helpers, and empty state.

## Non-Goals

This version does not add lesson video, files, descriptions, completion tracking, previews, publication scheduling, drag-and-drop, or child-course hierarchy changes. These can build on stable lesson IDs later without changing the chapter-and-lesson structure.
