import assert from "node:assert/strict";
import test from "node:test";

import {
  curriculumSummary,
  normalizeCurriculum,
} from "../lib/course-curriculum";

test("trims required titles and normalizes chapter and lesson order", () => {
  assert.deepEqual(
    normalizeCurriculum([
      {
        id: "chapter-a",
        title: "  Foundations  ",
        lessons: [
          { id: "lesson-a", title: "  Introduction  ", durationMinutes: 12 },
          { title: "Materials", durationMinutes: null },
        ],
      },
      { title: "Practice", lessons: [{ title: "Exercise" }] },
    ]),
    [
      {
        id: "chapter-a",
        title: "Foundations",
        order: 0,
        lessons: [
          {
            id: "lesson-a",
            title: "Introduction",
            durationMinutes: 12,
            order: 0,
          },
          { title: "Materials", durationMinutes: null, order: 1 },
        ],
      },
      {
        title: "Practice",
        order: 1,
        lessons: [
          { title: "Exercise", durationMinutes: null, order: 0 },
        ],
      },
    ],
  );
});

test("rejects chapter and lesson titles that are empty after trimming", () => {
  assert.throws(() => normalizeCurriculum([{ title: "  ", lessons: [] }]));
  assert.throws(() =>
    normalizeCurriculum([
      { title: "Chapter", lessons: [{ title: "\t\n" }] },
    ]),
  );
});

test("accepts only positive integer lesson durations when present", () => {
  for (const durationMinutes of [0, -1, 1.5, Number.NaN, "5", false]) {
    assert.throws(() =>
      normalizeCurriculum([
        {
          title: "Chapter",
          lessons: [{ title: "Lesson", durationMinutes }],
        },
      ]),
    );
  }
});

test("rejects malformed and globally duplicated IDs", () => {
  for (const id of ["", "   ", 1, null]) {
    assert.throws(() => normalizeCurriculum([{ id, title: "Chapter", lessons: [] }]));
  }

  assert.throws(() =>
    normalizeCurriculum([
      { id: "duplicate", title: "One", lessons: [] },
      { id: "duplicate", title: "Two", lessons: [] },
    ]),
  );
  assert.throws(() =>
    normalizeCurriculum([
      {
        title: "One",
        lessons: [{ id: "duplicate", title: "First" }],
      },
      {
        title: "Two",
        lessons: [{ id: "duplicate", title: "Second" }],
      },
    ]),
  );
});

test("rejects unknown keys and non-plain curriculum containers", () => {
  assert.throws(() =>
    normalizeCurriculum([{ title: "Chapter", lessons: [], foreignId: "x" }]),
  );
  assert.throws(() =>
    normalizeCurriculum([
      {
        title: "Chapter",
        lessons: [{ title: "Lesson", order: 99 }],
      },
    ]),
  );

  class ChapterInput {
    title = "Chapter";
    lessons: unknown[] = [];
  }
  class CurriculumArray extends Array<unknown> {}

  assert.throws(() => normalizeCurriculum([new ChapterInput()]));
  assert.throws(() => normalizeCurriculum(new CurriculumArray()));
  assert.throws(() =>
    normalizeCurriculum([
      { title: "Chapter", lessons: new CurriculumArray() },
    ]),
  );
  assert.throws(() => normalizeCurriculum({ 0: {}, length: 1 }));
});

test("normalizes and summarizes an empty curriculum", () => {
  const chapters = normalizeCurriculum([]);

  assert.deepEqual(chapters, []);
  assert.deepEqual(curriculumSummary(chapters), {
    chapterCount: 0,
    lessonCount: 0,
    totalDurationMinutes: 0,
  });
});

test("summarizes chapter, lesson, and duration totals", () => {
  const chapters = normalizeCurriculum([
    {
      title: "One",
      lessons: [
        { title: "First", durationMinutes: 10 },
        { title: "Second", durationMinutes: null },
      ],
    },
    {
      title: "Two",
      lessons: [{ title: "Third", durationMinutes: 25 }],
    },
  ]);

  assert.deepEqual(curriculumSummary(chapters), {
    chapterCount: 2,
    lessonCount: 3,
    totalDurationMinutes: 35,
  });
});
