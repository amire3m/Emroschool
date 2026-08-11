"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, Clock, LockKeyhole } from "lucide-react";

export interface CurriculumSummary {
  chapterCount: number;
  lessonCount: number;
  totalDurationMinutes: number;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  durationMinutes: number | null;
  order: number;
}

export interface CurriculumChapter {
  id: string;
  title: string;
  order: number;
  lessons: CurriculumLesson[];
}

export type CourseCurriculumData =
  | {
      curriculumLocked: true;
      curriculumSummary: CurriculumSummary;
      curriculum?: never;
    }
  | {
      curriculumLocked: false;
      curriculumSummary: CurriculumSummary;
      curriculum: CurriculumChapter[];
    };

export type CourseCurriculumView =
  | { state: "hidden" }
  | { state: "locked"; summary: CurriculumSummary }
  | {
      state: "enrolled";
      summary: CurriculumSummary;
      chapters: CurriculumChapter[];
    };

type CourseCurriculumProps =
  | { state: "hidden" }
  | {
      state: "locked";
      summary: CurriculumSummary;
      registrationAction: ReactNode;
    }
  | {
      state: "enrolled";
      summary: CurriculumSummary;
      chapters: CurriculumChapter[];
    };

export function createCourseCurriculumView(
  data: CourseCurriculumData,
): CourseCurriculumView {
  if (data.curriculumSummary.chapterCount === 0) return { state: "hidden" };

  if (data.curriculumLocked) {
    return { state: "locked", summary: data.curriculumSummary };
  }

  return {
    state: "enrolled",
    summary: data.curriculumSummary,
    chapters: [...data.curriculum]
      .sort((left, right) => left.order - right.order)
      .map((chapter) => ({
        ...chapter,
        lessons: [...chapter.lessons].sort(
          (left, right) => left.order - right.order,
        ),
      })),
  };
}

export function formatCurriculumDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts = [
    ...(hours ? [`${hours.toLocaleString("fa-IR")} ساعت`] : []),
    ...(remainingMinutes || !hours
      ? [`${remainingMinutes.toLocaleString("fa-IR")} دقیقه`]
      : []),
  ];
  return parts.join(" و ");
}

export function reconcileExpandedChapterId(
  current: string | null,
  chapters: Array<{ id: string }>,
) {
  if (chapters.length === 0) return null;
  return current && chapters.some(({ id }) => id === current)
    ? current
    : chapters[0].id;
}

function Summary({ summary }: { summary: CurriculumSummary }) {
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-outline">
      <div className="flex items-center gap-1.5">
        <dt>فصل</dt>
        <dd className="font-bold text-primary">
          {summary.chapterCount.toLocaleString("fa-IR")}
        </dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>درس</dt>
        <dd className="font-bold text-primary">
          {summary.lessonCount.toLocaleString("fa-IR")}
        </dd>
      </div>
      {summary.totalDurationMinutes > 0 && (
        <div className="flex items-center gap-1.5">
          <Clock size={15} aria-hidden="true" />
          <dt className="sr-only">مدت کل</dt>
          <dd className="font-bold text-primary">
            {formatCurriculumDuration(summary.totalDurationMinutes)}
          </dd>
        </div>
      )}
    </dl>
  );
}

export default function CourseCurriculum(props: CourseCurriculumProps) {
  if (props.state === "hidden") return null;

  if (props.state === "locked") {
    return (
      <section
        className="mt-10 rounded-2xl border border-outline-variant/40 bg-white p-5 shadow-sm sm:p-6"
        aria-labelledby="course-curriculum-title"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-primary">
            <LockKeyhole size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="course-curriculum-title"
              className="text-xl font-black text-primary"
            >
              سرفصل‌های دوره
            </h2>
            <div className="mt-3">
              <Summary summary={props.summary} />
            </div>
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-outline">
              عنوان فصل‌ها و درس‌ها برای دانشجویان ثبت‌نام‌شده نمایش داده می‌شود.
              برای دسترسی به برنامه کامل دوره، فرایند ثبت‌نام را تکمیل کنید.
            </p>
            <div className="mt-5 max-w-sm">{props.registrationAction}</div>
          </div>
        </div>
      </section>
    );
  }

  return <EnrolledCurriculum {...props} />;
}

function EnrolledCurriculum({
  summary,
  chapters,
}: Extract<CourseCurriculumProps, { state: "enrolled" }>) {
  const sectionId = useId().replace(/:/g, "");
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(
    chapters[0]?.id ?? null,
  );
  useEffect(() => {
    setExpandedChapterId((current) =>
      reconcileExpandedChapterId(current, chapters),
    );
  }, [chapters]);

  return (
    <section
      className="mt-10 overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-sm"
      aria-labelledby={`${sectionId}-title`}
    >
      <header className="border-b border-surface-variant px-5 py-5 sm:px-6">
        <h2 id={`${sectionId}-title`} className="text-xl font-black text-primary">
          سرفصل‌های دوره
        </h2>
        <div className="mt-3">
          <Summary summary={summary} />
        </div>
      </header>

      <div className="divide-y divide-surface-variant">
        {chapters.map((chapter, chapterIndex) => {
          const expanded = expandedChapterId === chapter.id;
          const buttonId = `${sectionId}-chapter-${chapterIndex + 1}`;
          const panelId = `${sectionId}-panel-${chapterIndex + 1}`;

          return (
            <div key={chapter.id}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() =>
                    setExpandedChapterId(expanded ? null : chapter.id)
                  }
                  className="flex w-full items-start gap-3 px-5 py-4 text-right hover:bg-surface-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary sm:px-6"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-black text-white">
                    {(chapterIndex + 1).toLocaleString("fa-IR")}
                  </span>
                  <span className="min-w-0 flex-1 break-words pt-1 font-black leading-7 text-primary">
                    {chapter.title}
                  </span>
                  <ChevronDown
                    size={19}
                    aria-hidden="true"
                    className={`mt-1.5 shrink-0 ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!expanded}
                className="bg-surface-low px-5 pb-5 pt-1 sm:px-6"
              >
                <ol className="mr-11 divide-y divide-outline-variant/30">
                  {chapter.lessons.map((lesson, lessonIndex) => (
                    <li
                      key={lesson.id}
                      className="flex items-start gap-3 py-3 text-sm"
                    >
                      <span className="shrink-0 pt-0.5 font-bold text-secondary">
                        {(lessonIndex + 1).toLocaleString("fa-IR")}.
                      </span>
                      <span className="min-w-0 flex-1 break-words leading-6 text-on-background">
                        {lesson.title}
                      </span>
                      {lesson.durationMinutes !== null && (
                        <span className="shrink-0 pt-0.5 text-xs text-outline">
                          {formatCurriculumDuration(lesson.durationMinutes)}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
