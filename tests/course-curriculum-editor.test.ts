import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CurriculumInput } from "../lib/course-curriculum";
import {
  addChapter,
  addLesson,
  canReplaceCourseContext,
  ContextReplacementGroup,
  createEditorState,
  createDetailRequestOwner,
  InlineDeleteConfirmation,
  MINUTE_INPUT_PATTERN,
  moveChapter,
  moveLesson,
  minuteInputError,
  normalizeMinuteInput,
  reconcileEditorState,
  removeChapter,
  removeLesson,
  syncMinuteInputValidity,
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

test("detail request ownership aborts predecessors and rejects stale success and finally", () => {
  const owner = createDetailRequestOwner();
  const first = owner.begin();
  const second = owner.begin();

  assert.equal(first.controller.signal.aborted, true);
  assert.equal(owner.isCurrent(first), false);
  assert.equal(owner.isCurrent(second), true);
  assert.equal(owner.finish(first), false);
  assert.equal(owner.isCurrent(second), true);
  assert.equal(owner.finish(second), true);
  assert.equal(owner.isCurrent(second), false);
});

test("save or modal context cancellation aborts and invalidates the current detail request", () => {
  const owner = createDetailRequestOwner();
  const request = owner.begin();

  owner.cancel();

  assert.equal(request.controller.signal.aborted, true);
  assert.equal(owner.isCurrent(request), false);
  assert.equal(owner.finish(request), false);
});

test("controlled internal edits preserve stable keys and invalid minute drafts", () => {
  const state = {
    ...createEditorState(persistedCurriculum, (kind) => `new-${kind}`),
    minuteDrafts: { "lesson-lesson-one": "1.5" },
    confirmDelete: "delete-lesson-lesson-one",
  };
  const internallyEdited: CurriculumInput = [
    { ...persistedCurriculum[0], title: "فصل ویرایش‌شده" },
    persistedCurriculum[1],
  ];

  const next = reconcileEditorState(
    state,
    internallyEdited,
    internallyEdited,
    (kind) => `replacement-${kind}`,
  );

  assert.strictEqual(next.controlledValue, internallyEdited);
  assert.strictEqual(next.keys, state.keys);
  assert.strictEqual(next.minuteDrafts, state.minuteDrafts);
  assert.equal(next.confirmDelete, "delete-lesson-lesson-one");
});

test("controlled external replacement rebuilds keys and clears stale lesson UI state", () => {
  const state = {
    ...createEditorState(persistedCurriculum, (kind) => `old-${kind}`),
    minuteDrafts: { "lesson-lesson-one": "1.5" },
    confirmDelete: "delete-lesson-lesson-one",
  };
  const replacement: CurriculumInput = [
    {
      id: "chapter-replacement",
      title: "فصل جایگزین",
      lessons: [{ id: "lesson-replacement", title: "درس جایگزین", durationMinutes: 9 }],
    },
  ];

  const next = reconcileEditorState(
    state,
    replacement,
    null,
    (kind) => `replacement-${kind}`,
  );

  assert.strictEqual(next.controlledValue, replacement);
  assert.deepEqual(next.keys, [
    { chapter: "chapter-chapter-replacement", lessons: ["lesson-lesson-replacement"] },
  ]);
  assert.deepEqual(next.minuteDrafts, {});
  assert.equal(next.confirmDelete, null);
});

test("disabled inline confirmation blocks both delete and cancel and enabled confirmation owns focus", () => {
  const disabledMarkup = renderToStaticMarkup(
    createElement(InlineDeleteConfirmation, {
      disabled: true,
      message: "این درس حذف شود؟",
      confirmLabel: "حذف درس",
      onConfirm() {},
      onCancel() {},
    }),
  );
  const enabledMarkup = renderToStaticMarkup(
    createElement(InlineDeleteConfirmation, {
      disabled: false,
      message: "این درس حذف شود؟",
      confirmLabel: "حذف درس",
      onConfirm() {},
      onCancel() {},
    }),
  );

  assert.equal((disabledMarkup.match(/ disabled=""/g) || []).length, 2);
  assert.equal((enabledMarkup.match(/ autofocus=""/g) || []).length, 1);
});

test("save ownership blocks modal close and course context replacement", () => {
  assert.equal(canReplaceCourseContext(true), false);
  assert.equal(canReplaceCourseContext(false), true);
});

test("mixed numeral minute input uses the same valid contract for parsing and submission", () => {
  const pattern = new RegExp(`^(?:${MINUTE_INPUT_PATTERN})$`);

  assert.equal(normalizeMinuteInput("1۲٣"), 123);
  assert.equal(minuteInputError("1۲٣"), "");
  assert.equal(pattern.test("1۲٣"), true);
  assert.equal(pattern.test("۰"), false);
  assert.equal(pattern.test("١.٥"), false);
});

test("database-out-of-range and arbitrarily long minute input remains invalid and never becomes Infinity", () => {
  const unsafe = "9007199254740992";
  const huge = "9".repeat(400);
  const pattern = new RegExp(`^(?:${MINUTE_INPUT_PATTERN})$`);

  assert.equal(normalizeMinuteInput("9007199254740991"), "9007199254740991");
  assert.equal(normalizeMinuteInput(unsafe), unsafe);
  assert.equal(normalizeMinuteInput(huge), huge);
  assert.notEqual(normalizeMinuteInput(huge), Infinity);
  assert.notEqual(minuteInputError(unsafe), "");
  assert.notEqual(minuteInputError(huge), "");
  assert.equal(pattern.test(huge), false);
});

test("minute input keeps the Prisma Int maximum valid and the next integer invalid", () => {
  assert.equal(normalizeMinuteInput("2147483647"), 2_147_483_647);
  assert.equal(minuteInputError("2147483647"), "");
  assert.equal(normalizeMinuteInput("2147483648"), "2147483648");
  assert.notEqual(minuteInputError("2147483648"), "");
});

test("in-modal add-child and child-edit controls inherit disabled semantics during save", () => {
  const markup = renderToStaticMarkup(
    createElement(
      ContextReplacementGroup,
      { saving: true },
      createElement("button", null, "افزودن زیر‌دوره جدید"),
      createElement("button", null, "ویرایش زیر‌دوره"),
    ),
  );

  assert.match(markup, /^<fieldset disabled="" aria-disabled="true"/);
  assert.match(markup, /:disabled\]:opacity-50/);
});

test("minute native validity clears stale errors for valid replacements and follows invalid drafts", () => {
  const input = {
    validationMessage: "",
    setCustomValidity(message: string) {
      this.validationMessage = message;
    },
  };

  syncMinuteInputValidity(input, "1.5");
  assert.notEqual(input.validationMessage, "");

  syncMinuteInputValidity(input, "25");
  assert.equal(input.validationMessage, "");

  syncMinuteInputValidity(input, "0");
  assert.notEqual(input.validationMessage, "");
});
