"use client";

import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Clock3,
  Plus,
  Trash2,
} from "lucide-react";
import type { CurriculumInput } from "@/lib/course-curriculum";

type MoveDirection = "up" | "down";

export type DetailRequest = {
  controller: AbortController;
};

export function createDetailRequestOwner() {
  let current: DetailRequest | null = null;

  return {
    begin() {
      current?.controller.abort();
      const request = { controller: new AbortController() };
      current = request;
      return request;
    },
    cancel() {
      current?.controller.abort();
      current = null;
    },
    isCurrent(request: DetailRequest) {
      return current === request && !request.controller.signal.aborted;
    },
    finish(request: DetailRequest) {
      if (current !== request) return false;
      current = null;
      return true;
    },
  };
}

export function canReplaceCourseContext(saving: boolean) {
  return !saving;
}

export type MinuteInputValue = number | null | string;
export const MINUTE_INPUT_PATTERN =
  "(?=.{1,16}$)[1-9۱-۹١-٩][0-9۰-۹٠-٩]*";
const MINUTE_INPUT_ERROR = "زمان باید یک عدد صحیح بزرگ‌تر از صفر باشد.";

export function addChapter(curriculum: CurriculumInput): CurriculumInput {
  return [...curriculum, { title: "", lessons: [] }];
}

export function removeChapter(
  curriculum: CurriculumInput,
  chapterIndex: number,
): CurriculumInput {
  return curriculum.filter((_, index) => index !== chapterIndex);
}

export function moveChapter(
  curriculum: CurriculumInput,
  chapterIndex: number,
  direction: MoveDirection,
): CurriculumInput {
  const destination = chapterIndex + (direction === "up" ? -1 : 1);
  if (destination < 0 || destination >= curriculum.length) return curriculum;

  const next = [...curriculum];
  [next[chapterIndex], next[destination]] = [next[destination], next[chapterIndex]];
  return next;
}

export function addLesson(
  curriculum: CurriculumInput,
  chapterIndex: number,
): CurriculumInput {
  return curriculum.map((chapter, index) =>
    index === chapterIndex
      ? {
          ...chapter,
          lessons: [...chapter.lessons, { title: "", durationMinutes: null }],
        }
      : chapter,
  );
}

export function removeLesson(
  curriculum: CurriculumInput,
  chapterIndex: number,
  lessonIndex: number,
): CurriculumInput {
  return curriculum.map((chapter, index) =>
    index === chapterIndex
      ? {
          ...chapter,
          lessons: chapter.lessons.filter((_, current) => current !== lessonIndex),
        }
      : chapter,
  );
}

export function moveLesson(
  curriculum: CurriculumInput,
  chapterIndex: number,
  lessonIndex: number,
  direction: MoveDirection,
): CurriculumInput {
  const chapter = curriculum[chapterIndex];
  const destination = lessonIndex + (direction === "up" ? -1 : 1);
  if (!chapter || destination < 0 || destination >= chapter.lessons.length) {
    return curriculum;
  }

  const lessons = [...chapter.lessons];
  [lessons[lessonIndex], lessons[destination]] = [
    lessons[destination],
    lessons[lessonIndex],
  ];
  return curriculum.map((current, index) =>
    index === chapterIndex ? { ...current, lessons } : current,
  );
}

export function normalizeMinuteInput(value: string): MinuteInputValue {
  if (value.trim() === "") return null;
  const normalizedDigits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const parsed = Number(normalizedDigits);
  if (/^\d+$/.test(normalizedDigits) && Number.isSafeInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return value;
}

export function minuteInputError(value: string) {
  if (value.trim() === "") return "";
  return typeof normalizeMinuteInput(value) === "number" ? "" : MINUTE_INPUT_ERROR;
}

export type EditorKeys = Array<{
  chapter: string;
  lessons: string[];
}>;

export type EditorState = {
  controlledValue: CurriculumInput;
  keys: EditorKeys;
  minuteDrafts: Record<string, string>;
  confirmDelete: string | null;
};

export function createEditorState(
  value: CurriculumInput,
  createKey: (kind: "chapter" | "lesson") => string,
): EditorState {
  return {
    controlledValue: value,
    keys: value.map((chapter) => ({
      chapter: chapter.id ? `chapter-${chapter.id}` : createKey("chapter"),
      lessons: chapter.lessons.map((lesson) =>
        lesson.id ? `lesson-${lesson.id}` : createKey("lesson"),
      ),
    })),
    minuteDrafts: {},
    confirmDelete: null,
  };
}

export function reconcileEditorState(
  state: EditorState,
  nextValue: CurriculumInput,
  internallyEmittedValue: CurriculumInput | null,
  createKey: (kind: "chapter" | "lesson") => string,
): EditorState {
  if (state.controlledValue === nextValue) return state;
  if (internallyEmittedValue === nextValue) {
    return { ...state, controlledValue: nextValue };
  }
  return createEditorState(nextValue, createKey);
}

type CourseCurriculumEditorProps = {
  value: CurriculumInput;
  onChange: (value: CurriculumInput) => void;
  disabled?: boolean;
};

type InlineDeleteConfirmationProps = {
  disabled: boolean;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function InlineDeleteConfirmation({
  disabled,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: InlineDeleteConfirmationProps) {
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-error-container px-3 py-2.5 text-sm text-error sm:flex-row sm:items-center">
      <p className="flex min-w-0 flex-1 items-start gap-2 leading-6">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          autoFocus={!disabled}
          disabled={disabled}
          onClick={onConfirm}
          className="rounded-lg bg-error px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="rounded-lg border border-error/20 bg-white px-3 py-2 text-xs font-bold text-error focus:outline-none focus:ring-2 focus:ring-error/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}

function moveItem<T>(items: T[], index: number, direction: MoveDirection) {
  const destination = index + (direction === "up" ? -1 : 1);
  if (destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export default function CourseCurriculumEditor({
  value,
  onChange,
  disabled = false,
}: CourseCurriculumEditorProps) {
  const nextKey = useRef(0);
  const createKey = (kind: "chapter" | "lesson") =>
    `curriculum-${kind}-${nextKey.current++}`;
  const pendingValue = useRef<CurriculumInput | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(() =>
    createEditorState(value, createKey),
  );
  if (editorState.controlledValue !== value) {
    setEditorState(reconcileEditorState(editorState, value, pendingValue.current, createKey));
    pendingValue.current = null;
  } else if (pendingValue.current === value) {
    pendingValue.current = null;
  }
  const { keys, minuteDrafts, confirmDelete } = editorState;
  const setKeys = (update: (current: EditorKeys) => EditorKeys) =>
    setEditorState((current) => ({ ...current, keys: update(current.keys) }));
  const setMinuteDrafts = (
    update: (current: Record<string, string>) => Record<string, string>,
  ) =>
    setEditorState((current) => ({
      ...current,
      minuteDrafts: update(current.minuteDrafts),
    }));
  const setConfirmDelete = (confirmDelete: string | null) =>
    setEditorState((current) => ({ ...current, confirmDelete }));
  const emitChange = (nextValue: CurriculumInput) => {
    pendingValue.current = nextValue;
    onChange(nextValue);
  };
  const lessonCount = value.reduce((count, chapter) => count + chapter.lessons.length, 0);

  const updateChapterTitle = (chapterIndex: number, title: string) => {
    emitChange(
      value.map((chapter, index) =>
        index === chapterIndex ? { ...chapter, title } : chapter,
      ),
    );
  };

  const updateLesson = (
    chapterIndex: number,
    lessonIndex: number,
    changes: Partial<CurriculumInput[number]["lessons"][number]>,
  ) => {
    emitChange(
      value.map((chapter, index) =>
        index === chapterIndex
          ? {
              ...chapter,
              lessons: chapter.lessons.map((lesson, current) =>
                current === lessonIndex ? { ...lesson, ...changes } : lesson,
              ),
            }
          : chapter,
      ),
    );
  };

  const appendChapter = () => {
    emitChange(addChapter(value));
    setKeys((current) => [
      ...current,
      { chapter: createKey("chapter"), lessons: [] },
    ]);
  };

  const appendLesson = (chapterIndex: number) => {
    emitChange(addLesson(value, chapterIndex));
    setKeys((current) =>
      current.map((chapter, index) =>
        index === chapterIndex
          ? { ...chapter, lessons: [...chapter.lessons, createKey("lesson")] }
          : chapter,
      ),
    );
  };

  const deleteChapter = (chapterIndex: number) => {
    emitChange(removeChapter(value, chapterIndex));
    setKeys((current) => current.filter((_, index) => index !== chapterIndex));
    setConfirmDelete(null);
  };

  const deleteLesson = (chapterIndex: number, lessonIndex: number) => {
    emitChange(removeLesson(value, chapterIndex, lessonIndex));
    setKeys((current) =>
      current.map((chapter, index) =>
        index === chapterIndex
          ? {
              ...chapter,
              lessons: chapter.lessons.filter((_, current) => current !== lessonIndex),
            }
          : chapter,
      ),
    );
    setConfirmDelete(null);
  };

  const reorderChapter = (chapterIndex: number, direction: MoveDirection) => {
    emitChange(moveChapter(value, chapterIndex, direction));
    setKeys((current) => moveItem(current, chapterIndex, direction));
  };

  const reorderLesson = (
    chapterIndex: number,
    lessonIndex: number,
    direction: MoveDirection,
  ) => {
    emitChange(moveLesson(value, chapterIndex, lessonIndex, direction));
    setKeys((current) =>
      current.map((chapter, index) =>
        index === chapterIndex
          ? { ...chapter, lessons: moveItem(chapter.lessons, lessonIndex, direction) }
          : chapter,
      ),
    );
  };

  const iconButton =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-variant bg-white text-outline hover:border-primary/30 hover:text-primary focus:outline-none focus:ring-2 focus:ring-[#ffdeab] disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-outline/40";
  const inputClass =
    "w-full rounded-xl border border-surface-variant bg-white px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-[#ffdeab] disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-outline";

  return (
    <section
      aria-labelledby="curriculum-editor-title"
      className="rounded-2xl border border-surface-variant bg-surface-low p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-surface-variant pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 id="curriculum-editor-title" className="font-bold text-primary">
            سرفصل‌ها و درس‌های دوره
          </h4>
          <p className="mt-1 text-xs leading-5 text-outline">
            {value.length.toLocaleString("fa-IR")} فصل و {lessonCount.toLocaleString("fa-IR")} درس؛ ترتیب نمایش را با دکمه‌های بالا و پایین تنظیم کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={appendChapter}
          disabled={disabled}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-[#ffdeab] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={17} aria-hidden="true" />
          افزودن فصل
        </button>
      </div>

      {value.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-fixed text-primary">
            <BookOpen size={23} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-primary">هنوز سرفصلی ثبت نشده است</p>
          <p className="mt-1 max-w-lg text-xs leading-6 text-outline">
            نخستین فصل را اضافه کنید و درس‌ها را به همان ترتیبی که دانشجو می‌بیند بچینید.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {value.map((chapter, chapterIndex) => {
            const chapterKey = keys[chapterIndex]?.chapter ?? `chapter-${chapterIndex}`;
            const chapterDeleteKey = `delete-${chapterKey}`;
            const chapterTitleId = `${chapterKey}-title`;
            return (
              <section
                key={chapterKey}
                aria-labelledby={`${chapterKey}-heading`}
                className="overflow-hidden rounded-2xl border border-surface-variant bg-white"
              >
                <div className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={chapterTitleId}
                        id={`${chapterKey}-heading`}
                        className="mb-1 block text-sm font-bold text-primary"
                      >
                        عنوان فصل {Number(chapterIndex + 1).toLocaleString("fa-IR")}
                      </label>
                      <textarea
                        id={chapterTitleId}
                        required
                        rows={2}
                        value={chapter.title}
                        onChange={(event) => updateChapterTitle(chapterIndex, event.target.value)}
                        disabled={disabled}
                        placeholder="برای نمونه: مبانی و پیش‌نیازها"
                        className={`${inputClass} resize-y break-words`}
                      />
                    </div>
                    <div className="flex items-center gap-2 self-end" aria-label="کنترل ترتیب فصل">
                      <button
                        type="button"
                        onClick={() => reorderChapter(chapterIndex, "up")}
                        disabled={disabled || chapterIndex === 0}
                        className={iconButton}
                        aria-label={`انتقال فصل ${chapterIndex + 1} به بالا`}
                        title="انتقال فصل به بالا"
                      >
                        <ArrowUp size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderChapter(chapterIndex, "down")}
                        disabled={disabled || chapterIndex === value.length - 1}
                        className={iconButton}
                        aria-label={`انتقال فصل ${chapterIndex + 1} به پایین`}
                        title="انتقال فصل به پایین"
                      >
                        <ArrowDown size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(chapterDeleteKey)}
                        disabled={disabled}
                        className={`${iconButton} hover:border-error/30 hover:bg-error-container hover:text-error`}
                        aria-label={`حذف فصل ${chapterIndex + 1}`}
                        title="حذف فصل"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {confirmDelete === chapterDeleteKey && (
                    <InlineDeleteConfirmation
                      disabled={disabled}
                      message="این فصل و همه درس‌های آن حذف شود؟"
                      confirmLabel="حذف فصل"
                      onConfirm={() => deleteChapter(chapterIndex)}
                      onCancel={() => setConfirmDelete(null)}
                    />
                  )}
                </div>

                <div className="border-t border-surface-variant">
                  {chapter.lessons.length === 0 ? (
                    <p className="px-4 py-5 text-center text-xs leading-6 text-outline">
                      این فصل هنوز درسی ندارد. نخستین درس را اضافه کنید.
                    </p>
                  ) : (
                    <div className="divide-y divide-surface-variant">
                      {chapter.lessons.map((lesson, lessonIndex) => {
                        const lessonKey =
                          keys[chapterIndex]?.lessons[lessonIndex] ??
                          `${chapterKey}-lesson-${lessonIndex}`;
                        const lessonDeleteKey = `delete-${lessonKey}`;
                        const titleId = `${lessonKey}-title`;
                        const durationId = `${lessonKey}-duration`;
                        const minuteDraft =
                          minuteDrafts[lessonKey] ??
                          (lesson.durationMinutes == null ? "" : String(lesson.durationMinutes));
                        const minuteError = minuteInputError(minuteDraft);
                        const minuteInvalid = Boolean(minuteError);
                        return (
                          <div key={lessonKey} className="p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
                              <div className="min-w-0">
                                <label htmlFor={titleId} className="mb-1 block text-xs font-bold text-primary">
                                  عنوان درس {Number(lessonIndex + 1).toLocaleString("fa-IR")}
                                </label>
                                <textarea
                                  id={titleId}
                                  required
                                  rows={2}
                                  value={lesson.title}
                                  onChange={(event) =>
                                    updateLesson(chapterIndex, lessonIndex, { title: event.target.value })
                                  }
                                  disabled={disabled}
                                  placeholder="عنوان درس"
                                  className={`${inputClass} resize-y break-words`}
                                />
                              </div>
                              <div>
                                <label htmlFor={durationId} className="mb-1 flex items-center gap-1 text-xs font-bold text-primary">
                                  <Clock3 size={14} aria-hidden="true" />
                                  زمان (دقیقه)
                                </label>
                                <input
                                  id={durationId}
                                  type="text"
                                  inputMode="numeric"
                                  pattern={MINUTE_INPUT_PATTERN}
                                  maxLength={16}
                                  value={minuteDraft}
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    const normalized = normalizeMinuteInput(raw);
                                    event.currentTarget.setCustomValidity(minuteInputError(raw));
                                    setMinuteDrafts((current) => ({ ...current, [lessonKey]: raw }));
                                    if (typeof normalized !== "string") {
                                      updateLesson(chapterIndex, lessonIndex, {
                                        durationMinutes: normalized,
                                      });
                                    }
                                  }}
                                  disabled={disabled}
                                  placeholder="اختیاری"
                                  aria-invalid={minuteInvalid}
                                  aria-describedby={`${durationId}-help`}
                                  className={`${inputClass} invalid:border-error invalid:focus:ring-error/20`}
                                  dir="ltr"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2" aria-label="کنترل ترتیب درس">
                                <button
                                  type="button"
                                  onClick={() => reorderLesson(chapterIndex, lessonIndex, "up")}
                                  disabled={disabled || lessonIndex === 0}
                                  className={iconButton}
                                  aria-label={`انتقال درس ${lessonIndex + 1} به بالا`}
                                  title="انتقال درس به بالا"
                                >
                                  <ArrowUp size={16} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => reorderLesson(chapterIndex, lessonIndex, "down")}
                                  disabled={disabled || lessonIndex === chapter.lessons.length - 1}
                                  className={iconButton}
                                  aria-label={`انتقال درس ${lessonIndex + 1} به پایین`}
                                  title="انتقال درس به پایین"
                                >
                                  <ArrowDown size={16} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(lessonDeleteKey)}
                                  disabled={disabled}
                                  className={`${iconButton} hover:border-error/30 hover:bg-error-container hover:text-error`}
                                  aria-label={`حذف درس ${lessonIndex + 1}`}
                                  title="حذف درس"
                                >
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                            <p
                              id={`${durationId}-help`}
                              className={`mt-1 text-xs ${minuteInvalid ? "text-error" : "text-outline"}`}
                            >
                              {minuteInvalid
                                ? minuteError
                                : "اختیاری؛ فقط عدد صحیح بزرگ‌تر از صفر"}
                            </p>
                            {confirmDelete === lessonDeleteKey && (
                              <InlineDeleteConfirmation
                                disabled={disabled}
                                message="این درس حذف شود؟"
                                confirmLabel="حذف درس"
                                onConfirm={() => deleteLesson(chapterIndex, lessonIndex)}
                                onCancel={() => setConfirmDelete(null)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="border-t border-surface-variant bg-surface-low/60 p-3">
                    <button
                      type="button"
                      onClick={() => appendLesson(chapterIndex)}
                      disabled={disabled}
                      className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-bold text-primary hover:border-primary/40 hover:bg-secondary-fixed/30 focus:outline-none focus:ring-2 focus:ring-[#ffdeab] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={15} aria-hidden="true" />
                      افزودن درس به این فصل
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
