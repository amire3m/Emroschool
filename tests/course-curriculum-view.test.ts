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

  assert.equal(controls.length, 2);
  assert.equal(new Set(controls).size, 2);
  for (const panelId of controls) {
    assert.match(markup, new RegExp(`id="${panelId}"`));
  }
  assert.match(markup, /<button[^>]*aria-expanded="true"[^>]*>/);
  assert.match(markup, /<button[^>]*aria-expanded="false"[^>]*>/);
  assert.ok(markup.indexOf("فصل اول") < markup.indexOf("فصل دوم"));
  assert.ok(markup.indexOf("درس اول") < markup.indexOf("درس دوم"));
  assert.match(markup, /۱ ساعت و ۵ دقیقه/);
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
