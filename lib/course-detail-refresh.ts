export interface RefreshableCourse {
  slug: string;
  curriculumLocked: boolean;
  curriculumSummary: { chapterCount: number };
}

export interface CourseRefreshState<
  TCourse extends RefreshableCourse,
  TImage = unknown,
> {
  slug: string;
  course: TCourse | null;
  courseImages: TImage[];
  loading: boolean;
  notFound: boolean;
  error: boolean;
  isEnrolled: boolean;
  applicationStatus: string | null;
  applicationId: string | null;
  registrationOpen: boolean;
  curriculumRefreshing: boolean;
}

export function createCourseRefreshOwner(slug: string) {
  const controller = new AbortController();
  let active = true;

  return {
    signal: controller.signal,
    isCurrent(candidateSlug: string) {
      return active && candidateSlug === slug && !controller.signal.aborted;
    },
    cancel() {
      active = false;
      controller.abort();
    },
  };
}

export function commitCurrentCourseRefreshState<TState extends { slug: string }>(
  owner: { isCurrent: (slug: string) => boolean },
  slug: string,
  current: TState,
  updates: Partial<TState>,
) {
  if (!owner.isCurrent(slug) || current.slug !== slug) return current;
  return { ...current, ...updates };
}

export function startIndependentCourseRefreshes(tasks: {
  enrollment: () => Promise<void>;
  application: () => Promise<void>;
}) {
  const enrollment = tasks.enrollment();
  const application = tasks.application();
  return { enrollment, application };
}

export function createCourseRefreshState<
  TCourse extends RefreshableCourse,
  TImage = unknown,
>(
  slug: string,
  initialCourse: TCourse | null,
): CourseRefreshState<TCourse, TImage> {
  const course =
    initialCourse?.slug === slug && initialCourse.curriculumLocked
      ? initialCourse
      : null;

  return {
    slug,
    course,
    courseImages: [],
    loading: course === null,
    notFound: false,
    error: false,
    isEnrolled: false,
    applicationStatus: null,
    applicationId: null,
    registrationOpen: false,
    curriculumRefreshing: Boolean(
      course && course.curriculumSummary.chapterCount > 0,
    ),
  };
}

export function finishCourseRefreshFailure<
  TCourse extends RefreshableCourse,
  TImage,
>(
  baseline: CourseRefreshState<TCourse, TImage>,
  authoritativeNotFound: boolean,
): CourseRefreshState<TCourse, TImage> {
  return {
    ...baseline,
    course: authoritativeNotFound ? null : baseline.course,
    loading: false,
    notFound: authoritativeNotFound,
    error: !authoritativeNotFound && baseline.course === null,
    curriculumRefreshing: false,
  };
}

export function registrationActionPlacement(
  refreshing: boolean,
  curriculumState: "hidden" | "locked" | "enrolled",
) {
  if (refreshing) return "hidden" as const;
  return curriculumState === "locked"
    ? ("curriculum" as const)
    : ("sidebar" as const);
}
