import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CourseCurriculumData } from "../components/courses/course-curriculum";

Object.assign(globalThis, { React });

const summary = {
  chapterCount: 2,
  lessonCount: 3,
  totalDurationMinutes: 110,
};

const curriculum = [
  {
    id: "chapter-later",
    title: "فصل دوم با عنوانی بسیار بلند که باید بدون حذف شدن در چند خط نمایش داده شود",
    order: 2,
    lessons: [
      {
        id: "lesson-later",
        title: "درس سوم",
        durationMinutes: 65,
        order: 3,
      },
    ],
  },
  {
    id: "chapter-first",
    title: "فصل اول",
    order: 1,
    lessons: [
      {
        id: "lesson-second",
        title: "درس دوم",
        durationMinutes: null,
        order: 2,
      },
      {
        id: "lesson-first",
        title: "درس اول",
        durationMinutes: 45,
        order: 1,
      },
    ],
  },
];

async function loadSubject() {
  return import("../components/courses/course-curriculum").catch(() => null);
}

async function loadRefreshSubject() {
  return import("../lib/course-detail-refresh").catch(() => null);
}

test("zero-chapter curricula render no view in locked or enrolled states", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");

  const emptySummary = {
    chapterCount: 0,
    lessonCount: 0,
    totalDurationMinutes: 0,
  };
  assert.deepEqual(
    subject.createCourseCurriculumView({
      curriculumLocked: true,
      curriculumSummary: emptySummary,
    }),
    { state: "hidden" },
  );
  assert.deepEqual(
    subject.createCourseCurriculumView({
      curriculumLocked: false,
      curriculumSummary: emptySummary,
      curriculum: [],
    }),
    { state: "hidden" },
  );
});

test("locked view exposes summary numbers without any curriculum row field", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");

  const view = subject.createCourseCurriculumView({
    curriculumLocked: true,
    curriculumSummary: summary,
  });

  assert.deepEqual(view, { state: "locked", summary });
  assert.equal("curriculum" in view, false);
  assert.equal("chapters" in view, false);
  assert.equal("title" in view, false);
});

test("enrolled view orders chapters and lessons before rendering", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");

  const view = subject.createCourseCurriculumView({
    curriculumLocked: false,
    curriculumSummary: summary,
    curriculum,
  });

  assert.equal(view.state, "enrolled");
  if (view.state !== "enrolled") return;
  assert.deepEqual(
    view.chapters.map((chapter) => ({
      id: chapter.id,
      lessonIds: chapter.lessons.map((lesson) => lesson.id),
    })),
    [
      { id: "chapter-first", lessonIds: ["lesson-first", "lesson-second"] },
      { id: "chapter-later", lessonIds: ["lesson-later"] },
    ],
  );
});

test("duration formatting uses Persian numbers for minutes and hours", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");

  assert.equal(subject.formatCurriculumDuration(0), "۰ دقیقه");
  assert.equal(subject.formatCurriculumDuration(45), "۴۵ دقیقه");
  assert.equal(subject.formatCurriculumDuration(65), "۱ ساعت و ۵ دقیقه");
  assert.equal(subject.formatCurriculumDuration(120), "۲ ساعت");
});

test("enrolled markup starts with the first chapter expanded and linked ARIA panels", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");
  const view = subject.createCourseCurriculumView({
    curriculumLocked: false,
    curriculumSummary: summary,
    curriculum,
  });
  assert.equal(view.state, "enrolled");
  if (view.state !== "enrolled") return;

  const markup = renderToStaticMarkup(
    React.createElement(subject.default, view),
  );
  const controls = [...markup.matchAll(/aria-controls="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const buttonLinks = [
    ...markup.matchAll(
      /<button[^>]*id="([^"]+)"[^>]*aria-expanded="[^"]+"[^>]*aria-controls="([^"]+)"[^>]*>/g,
    ),
  ].map((match) => ({ buttonId: match[1], panelId: match[2] }));

  assert.equal(controls.length, 2);
  assert.equal(new Set(controls).size, 2);
  assert.equal(buttonLinks.length, 2);
  for (const { buttonId, panelId } of buttonLinks) {
    assert.match(
      markup,
      new RegExp(
        `<div id="${panelId}" role="region" aria-labelledby="${buttonId}"`,
      ),
    );
  }
  assert.match(markup, /<button[^>]*aria-expanded="true"[^>]*>/);
  assert.match(markup, /<button[^>]*aria-expanded="false"[^>]*>/);
  assert.ok(markup.indexOf("فصل اول") < markup.indexOf("فصل دوم"));
  assert.ok(markup.indexOf("درس اول") < markup.indexOf("درس دوم"));
  assert.match(markup, /۱ ساعت و ۵ دقیقه/);
});

test("separate curriculum instances produce globally unique panel IDs", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");
  const view = subject.createCourseCurriculumView({
    curriculumLocked: false,
    curriculumSummary: summary,
    curriculum,
  });
  assert.equal(view.state, "enrolled");
  if (view.state !== "enrolled") return;

  const markup = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(subject.default, { ...view, key: "first" }),
      React.createElement(subject.default, { ...view, key: "second" }),
    ),
  );
  const controls = [...markup.matchAll(/aria-controls="([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.equal(controls.length, 4);
  assert.equal(new Set(controls).size, 4);
});

test("course refresh owner aborts and suppresses every stale slug continuation", async () => {
  const subject = await loadRefreshSubject();
  assert.ok(subject, "course detail refresh module should exist");

  const oldRequest = subject.createCourseRefreshOwner("old-course");
  oldRequest.cancel();
  const currentRequest = subject.createCourseRefreshOwner("new-course");

  assert.equal(oldRequest.signal.aborted, true);
  assert.equal(oldRequest.isCurrent("old-course"), false);
  assert.equal(oldRequest.isCurrent("new-course"), false);
  assert.equal(currentRequest.isCurrent("old-course"), false);
  assert.equal(currentRequest.isCurrent("new-course"), true);
});

test("course refresh state commit rechecks ownership when a queued updater executes", async () => {
  const subject = await loadRefreshSubject();
  assert.ok(subject, "course detail refresh module should exist");
  const commit = (
    subject as unknown as {
      commitCurrentCourseRefreshState?: (
        owner: { isCurrent: (slug: string) => boolean },
        slug: string,
        current: { slug: string; marker: string },
        updates: { marker: string },
      ) => { slug: string; marker: string };
    }
  ).commitCurrentCourseRefreshState;
  assert.equal(typeof commit, "function");
  if (!commit) return;
  const queuedOwner = subject.createCourseRefreshOwner("same-course");
  const replacementState = { slug: "same-course", marker: "safe baseline" };
  queuedOwner.cancel();

  assert.strictEqual(
    commit(queuedOwner, "same-course", replacementState, {
      marker: "stale protected success",
    }),
    replacementState,
  );
});

test("slug reset drops earlier protected data and clears all course-scoped state", async () => {
  const subject = await loadRefreshSubject();
  assert.ok(subject, "course detail refresh module should exist");
  const oldAuthorizedCourse = {
    slug: "old-course",
    curriculumLocked: false as const,
    curriculumSummary: summary,
    curriculum,
  };

  assert.deepEqual(
    subject.createCourseRefreshState("new-course", oldAuthorizedCourse),
    {
      slug: "new-course",
      course: null,
      courseImages: [],
      loading: true,
      notFound: false,
      isEnrolled: false,
      applicationStatus: null,
      applicationId: null,
      registrationOpen: false,
      curriculumRefreshing: false,
    },
  );
});

test("refresh failure retains a matching locked SSR baseline but never an older course", async () => {
  const subject = await loadRefreshSubject();
  assert.ok(subject, "course detail refresh module should exist");
  const lockedInitial = {
    slug: "current-course",
    curriculumLocked: true as const,
    curriculumSummary: summary,
  };
  const baseline = subject.createCourseRefreshState(
    "current-course",
    lockedInitial,
  );

  assert.deepEqual(subject.finishCourseRefreshFailure(baseline, false), {
    ...baseline,
    loading: false,
    notFound: false,
    curriculumRefreshing: false,
  });
  assert.deepEqual(subject.finishCourseRefreshFailure(baseline, true), {
    ...baseline,
    course: null,
    loading: false,
    notFound: true,
    curriculumRefreshing: false,
  });
});

test("registration action relocates once from sidebar to a settled locked curriculum", async () => {
  const subject = await loadRefreshSubject();
  assert.ok(subject, "course detail refresh module should exist");

  assert.equal(subject.registrationActionPlacement(true, "hidden"), "hidden");
  assert.equal(subject.registrationActionPlacement(false, "locked"), "curriculum");
  assert.equal(subject.registrationActionPlacement(false, "enrolled"), "sidebar");
  assert.equal(subject.registrationActionPlacement(false, "hidden"), "sidebar");
});

test("expanded chapter reconciliation preserves valid IDs and replaces stale IDs", async () => {
  const subject = await loadSubject();
  assert.ok(subject, "course curriculum view module should exist");
  const reconcile = (
    subject as unknown as {
      reconcileExpandedChapterId?: (
        current: string | null,
        chapters: Array<{ id: string }>,
      ) => string | null;
    }
  ).reconcileExpandedChapterId;
  assert.equal(typeof reconcile, "function");
  if (!reconcile) return;

  assert.equal(reconcile("chapter-later", curriculum), "chapter-later");
  assert.equal(reconcile("removed", curriculum), "chapter-later");
  assert.equal(reconcile(null, curriculum), "chapter-later");
  assert.equal(reconcile("chapter-later", []), null);
});

const validLockedData: CourseCurriculumData = {
  curriculumLocked: true,
  curriculumSummary: summary,
};
void validLockedData;

// @ts-expect-error Locked data cannot carry protected curriculum rows.
const invalidLockedData: CourseCurriculumData = {
  curriculumLocked: true,
  curriculumSummary: summary,
  curriculum,
};
void invalidLockedData;
