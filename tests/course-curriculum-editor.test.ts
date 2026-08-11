import assert from "node:assert/strict";
import test from "node:test";

import type { CurriculumInput } from "../lib/course-curriculum";
import {
  addChapter,
  addLesson,
  moveChapter,
  moveLesson,
  normalizeMinuteInput,
  removeChapter,
  removeLesson,
} from "../components/admin/course-curriculum-editor";

const persistedCurriculum: CurriculumInput = [
  {
    id: "chapter-one",
    title: "فصل اول",
    lessons: [
      { id: "lesson-one", title: "درس اول", durationMinutes: 12 },
      { id: "lesson-two", title: "درس دوم", durationMinutes: null },
    ],
  },
  {
    id: "chapter-two",
    title: "فصل دوم",
    lessons: [{ id: "lesson-three", title: "درس سوم", durationMinutes: 8 }],
  },
];

test("adds ID-free chapters and lessons without mutating persisted curriculum", () => {
  const withChapter = addChapter(persistedCurriculum);
  const withLesson = addLesson(persistedCurriculum, 1);

  assert.deepEqual(withChapter, [
    ...persistedCurriculum,
    { title: "", lessons: [] },
  ]);
  assert.deepEqual(withLesson, [
    persistedCurriculum[0],
    {
      ...persistedCurriculum[1],
      lessons: [
        ...persistedCurriculum[1].lessons,
        { title: "", durationMinutes: null },
      ],
    },
  ]);
  assert.deepEqual(persistedCurriculum, [
    {
      id: "chapter-one",
      title: "فصل اول",
      lessons: [
        { id: "lesson-one", title: "درس اول", durationMinutes: 12 },
        { id: "lesson-two", title: "درس دوم", durationMinutes: null },
      ],
    },
    {
      id: "chapter-two",
      title: "فصل دوم",
      lessons: [{ id: "lesson-three", title: "درس سوم", durationMinutes: 8 }],
    },
  ]);
});

test("removes only the selected chapter or lesson and preserves stable IDs", () => {
  assert.deepEqual(removeChapter(persistedCurriculum, 0), [persistedCurriculum[1]]);
  assert.deepEqual(removeLesson(persistedCurriculum, 0, 0), [
    {
      id: "chapter-one",
      title: "فصل اول",
      lessons: [{ id: "lesson-two", title: "درس دوم", durationMinutes: null }],
    },
    persistedCurriculum[1],
  ]);
});

test("moves chapters immutably while keeping persisted IDs attached to their data", () => {
  const moved = moveChapter(persistedCurriculum, 1, "up");

  assert.deepEqual(moved, [persistedCurriculum[1], persistedCurriculum[0]]);
  assert.notStrictEqual(moved, persistedCurriculum);
  assert.deepEqual(persistedCurriculum.map(({ id }) => id), [
    "chapter-one",
    "chapter-two",
  ]);
});

test("moves lessons immutably while keeping persisted IDs attached to their data", () => {
  const moved = moveLesson(persistedCurriculum, 0, 1, "up");

  assert.deepEqual(moved[0].lessons, [
    { id: "lesson-two", title: "درس دوم", durationMinutes: null },
    { id: "lesson-one", title: "درس اول", durationMinutes: 12 },
  ]);
  assert.notStrictEqual(moved, persistedCurriculum);
  assert.deepEqual(persistedCurriculum[0].lessons.map(({ id }) => id), [
    "lesson-one",
    "lesson-two",
  ]);
});

test("returns the original curriculum for first-up and last-down moves", () => {
  assert.strictEqual(moveChapter(persistedCurriculum, 0, "up"), persistedCurriculum);
  assert.strictEqual(moveChapter(persistedCurriculum, 1, "down"), persistedCurriculum);
  assert.strictEqual(moveLesson(persistedCurriculum, 0, 0, "up"), persistedCurriculum);
  assert.strictEqual(moveLesson(persistedCurriculum, 0, 1, "down"), persistedCurriculum);
});

test("normalizes blank and positive integer minute input without hiding invalid values", () => {
  assert.equal(normalizeMinuteInput(""), null);
  assert.equal(normalizeMinuteInput("   "), null);
  assert.equal(normalizeMinuteInput("15"), 15);
  assert.equal(normalizeMinuteInput("۱۵"), 15);
  assert.equal(normalizeMinuteInput("٠٨"), 8);
  assert.equal(normalizeMinuteInput("0"), "0");
  assert.equal(normalizeMinuteInput("-2"), "-2");
  assert.equal(normalizeMinuteInput("1.5"), "1.5");
  assert.equal(normalizeMinuteInput("abc"), "abc");
});
