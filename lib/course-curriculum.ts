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
