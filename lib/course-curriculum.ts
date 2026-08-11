import type { Prisma } from "@prisma/client";

export type CurriculumInput = Array<{
  id?: string;
  title: string;
  lessons: Array<{
    id?: string;
    title: string;
    durationMinutes?: number | null;
  }>;
}>;

export type NormalizedCurriculum = Array<{
  id?: string;
  title: string;
  order: number;
  lessons: Array<{
    id?: string;
    title: string;
    durationMinutes: number | null;
    order: number;
  }>;
}>;

const chapterKeys = new Set(["id", "title", "lessons"]);
const lessonKeys = new Set(["id", "title", "durationMinutes"]);

function isPlainArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertKnownKeys(value: Record<string, unknown>, keys: Set<string>) {
  if (Object.keys(value).some((key) => !keys.has(key))) {
    throw new TypeError("Curriculum contains unknown fields");
  }
}

function requiredTitle(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("Curriculum titles are required");
  }
  return value.trim();
}

function optionalId(value: unknown, seen: Set<string>) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("Curriculum IDs must be non-empty strings");
  }
  if (seen.has(value)) {
    throw new TypeError("Curriculum IDs must be unique");
  }
  seen.add(value);
  return value;
}

export function normalizeCurriculum(input: unknown): NormalizedCurriculum {
  if (!isPlainArray(input)) {
    throw new TypeError("Curriculum must be an array");
  }

  const chapterIds = new Set<string>();
  const lessonIds = new Set<string>();

  return input.map((chapter, chapterOrder) => {
    if (!isPlainObject(chapter)) {
      throw new TypeError("Curriculum chapters must be objects");
    }
    assertKnownKeys(chapter, chapterKeys);
    if (!isPlainArray(chapter.lessons)) {
      throw new TypeError("Chapter lessons must be an array");
    }

    const id = optionalId(chapter.id, chapterIds);
    const lessons = chapter.lessons.map((lesson, lessonOrder) => {
      if (!isPlainObject(lesson)) {
        throw new TypeError("Curriculum lessons must be objects");
      }
      assertKnownKeys(lesson, lessonKeys);

      const lessonId = optionalId(lesson.id, lessonIds);
      const duration = lesson.durationMinutes;
      if (
        duration !== null &&
        duration !== undefined &&
        (!Number.isInteger(duration) || (duration as number) <= 0)
      ) {
        throw new TypeError("Lesson duration must be a positive integer");
      }

      return {
        ...(lessonId === undefined ? {} : { id: lessonId }),
        title: requiredTitle(lesson.title),
        durationMinutes: duration == null ? null : (duration as number),
        order: lessonOrder,
      };
    });

    return {
      ...(id === undefined ? {} : { id }),
      title: requiredTitle(chapter.title),
      order: chapterOrder,
      lessons,
    };
  });
}

export function curriculumSummary(chapters: NormalizedCurriculum) {
  return chapters.reduce(
    (summary, chapter) => {
      summary.lessonCount += chapter.lessons.length;
      for (const lesson of chapter.lessons) {
        summary.totalDurationMinutes += lesson.durationMinutes ?? 0;
      }
      return summary;
    },
    {
      chapterCount: chapters.length,
      lessonCount: 0,
      totalDurationMinutes: 0,
    },
  );
}

export function serializeCurriculum({
  chapters,
  canReadTitles,
}: {
  chapters: NormalizedCurriculum;
  canReadTitles: boolean;
}) {
  const summary = curriculumSummary(chapters);
  if (!canReadTitles) {
    return {
      curriculumLocked: true as const,
      curriculumSummary: summary,
    };
  }

  return {
    curriculumLocked: false as const,
    curriculumSummary: summary,
    curriculum: [...chapters]
      .sort((left, right) => left.order - right.order)
      .map((chapter) => ({
        ...(chapter.id === undefined ? {} : { id: chapter.id }),
        title: chapter.title,
        order: chapter.order,
        lessons: [...chapter.lessons]
          .sort((left, right) => left.order - right.order)
          .map((lesson) => ({
            ...(lesson.id === undefined ? {} : { id: lesson.id }),
            title: lesson.title,
            durationMinutes: lesson.durationMinutes,
            order: lesson.order,
          })),
      })),
  };
}

export const COURSE_CURRICULUM_OWNERSHIP_ERROR = "COURSE_CURRICULUM_OWNERSHIP";

export async function syncCourseCurriculum(
  tx: Prisma.TransactionClient,
  courseId: string,
  curriculum: NormalizedCurriculum,
) {
  const ownedChapters = await tx.courseChapter.findMany({
    where: { courseId },
    select: { id: true, lessons: { select: { id: true } } },
  });
  const ownedChapterIds = new Set(ownedChapters.map(({ id }) => id));
  const ownedLessonIds = new Set(
    ownedChapters.flatMap(({ lessons }) => lessons.map(({ id }) => id)),
  );

  for (const chapter of curriculum) {
    if (chapter.id && !ownedChapterIds.has(chapter.id)) {
      throw Object.assign(new Error("Course curriculum chapter is not owned"), {
        code: COURSE_CURRICULUM_OWNERSHIP_ERROR,
      });
    }
    for (const lesson of chapter.lessons) {
      if (lesson.id && !ownedLessonIds.has(lesson.id)) {
        throw Object.assign(new Error("Course curriculum lesson is not owned"), {
          code: COURSE_CURRICULUM_OWNERSHIP_ERROR,
        });
      }
    }
  }

  const persistedChapters: Array<{
    id: string;
    lessons: NormalizedCurriculum[number]["lessons"];
  }> = [];
  for (const chapter of curriculum) {
    const persisted = chapter.id
      ? await tx.courseChapter.update({
          where: { id: chapter.id },
          data: { title: chapter.title, order: chapter.order },
          select: { id: true },
        })
      : await tx.courseChapter.create({
          data: { courseId, title: chapter.title, order: chapter.order },
          select: { id: true },
        });
    persistedChapters.push({ id: persisted.id, lessons: chapter.lessons });
  }

  for (const chapter of persistedChapters) {
    for (const lesson of chapter.lessons) {
      if (lesson.id) {
        await tx.courseLesson.update({
          where: { id: lesson.id },
          data: {
            chapterId: chapter.id,
            title: lesson.title,
            durationMinutes: lesson.durationMinutes,
            order: lesson.order,
          },
        });
      } else {
        await tx.courseLesson.create({
          data: {
            chapterId: chapter.id,
            title: lesson.title,
            durationMinutes: lesson.durationMinutes,
            order: lesson.order,
          },
        });
      }
    }
  }

  const retainedLessonIds = new Set(
    curriculum.flatMap(({ lessons }) => lessons.flatMap(({ id }) => (id ? [id] : []))),
  );
  const omittedLessonIds = [...ownedLessonIds].filter((id) => !retainedLessonIds.has(id));
  if (omittedLessonIds.length) {
    await tx.courseLesson.deleteMany({ where: { id: { in: omittedLessonIds } } });
  }

  const retainedChapterIds = new Set(
    curriculum.flatMap(({ id }) => (id ? [id] : [])),
  );
  const omittedChapterIds = [...ownedChapterIds].filter((id) => !retainedChapterIds.has(id));
  if (omittedChapterIds.length) {
    await tx.courseChapter.deleteMany({ where: { id: { in: omittedChapterIds } } });
  }

  await tx.course.update({
    where: { id: courseId },
    data: { updatedAt: new Date() },
  });
}
