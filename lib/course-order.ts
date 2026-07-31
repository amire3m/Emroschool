interface SchedulableCourse {
  scheduleStatus: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

function dateValue(value?: Date | string | null, fallback = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? fallback : timestamp;
}

export function sortCoursesBySchedule<T extends SchedulableCourse>(courses: T[]) {
  return [...courses].sort((first, second) => {
    const firstCompleted = first.scheduleStatus === "completed";
    const secondCompleted = second.scheduleStatus === "completed";
    if (firstCompleted !== secondCompleted) return Number(firstCompleted) - Number(secondCompleted);
    if (!firstCompleted) return dateValue(first.startDate) - dateValue(second.startDate);
    return dateValue(second.endDate, 0) - dateValue(first.endDate, 0);
  });
}
