import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

import CourseLayout from "../app/(site)/courses/[slug]/layout";
import { GET as getCourse } from "../app/api/courses/[id]/route";
import { generateToken } from "../lib/auth";
import prisma from "../lib/prisma";

Object.assign(globalThis, { React });

const SECRET_CHAPTER_TITLE = "VAULT_CHAPTER_COBALT_731";
const SECRET_LESSON_TITLE = "VAULT_LESSON_SAFFRON_947";

const curriculum = [
  {
    id: "chapter-1",
    courseId: "course-1",
    title: SECRET_CHAPTER_TITLE,
    order: 0,
    createdAt: new Date("2026-08-11T10:00:00.000Z"),
    updatedAt: new Date("2026-08-11T10:00:00.000Z"),
    lessons: [
      {
        id: "lesson-1",
        chapterId: "chapter-1",
        title: SECRET_LESSON_TITLE,
        durationMinutes: 42,
        order: 0,
        createdAt: new Date("2026-08-11T10:00:00.000Z"),
        updatedAt: new Date("2026-08-11T10:00:00.000Z"),
      },
    ],
  },
];

function courseFixture() {
  return {
    id: "course-1",
    title: "Public course",
    slug: "public-course",
    description: "Public description",
    thumbnail: null,
    instructor: null,
    startDate: null,
    children: [],
    chapters: curriculum,
  };
}

function request(user?: { id: string; role: string }) {
  const token = user
    ? generateToken({ id: user.id, email: `${user.id}@example.com`, role: user.role })
    : null;
  return new NextRequest("http://localhost/api/courses/course-1", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const expectedSummary = {
  chapterCount: 1,
  lessonCount: 1,
  totalDurationMinutes: 42,
};

const expectedCurriculum = [
  {
    id: "chapter-1",
    title: SECRET_CHAPTER_TITLE,
    order: 0,
    lessons: [
      {
        id: "lesson-1",
        title: SECRET_LESSON_TITLE,
        durationMinutes: 42,
        order: 0,
      },
    ],
  },
];

async function withCourseApiFixture(
  grantCountForUserId: number | null,
  run: (grantLookups: unknown[]) => Promise<void>,
) {
  const courseDelegate = prisma.course as unknown as {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  const grantDelegate = prisma.enrollmentGrant as unknown as {
    count: (args: unknown) => Promise<number>;
  };
  const originalCourseFindUnique = courseDelegate.findUnique;
  const originalGrantCount = grantDelegate.count;
  const grantLookups: unknown[] = [];
  courseDelegate.findUnique = async () => courseFixture();
  grantDelegate.count = async (args) => {
    grantLookups.push(args);
    return grantCountForUserId ?? 0;
  };
  try {
    await run(grantLookups);
  } finally {
    courseDelegate.findUnique = originalCourseFindUnique;
    grantDelegate.count = originalGrantCount;
  }
}

function assertLockedCourse(course: Record<string, unknown>) {
  const serialized = JSON.stringify(course);
  assert.equal(serialized.includes(SECRET_CHAPTER_TITLE), false);
  assert.equal(serialized.includes(SECRET_LESSON_TITLE), false);
  assert.equal(course.curriculumLocked, true);
  assert.deepEqual(course.curriculumSummary, expectedSummary);
  assert.equal(Object.prototype.hasOwnProperty.call(course, "curriculum"), false);
}

test("trusted admins receive the ordered allowlisted curriculum without enrollment", async () => {
  await withCourseApiFixture(0, async (grantLookups) => {
    const response = await getCourse(request({ id: "admin-1", role: "admin" }), {
      params: { id: "course-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.course.curriculumLocked, false);
    assert.deepEqual(body.course.curriculumSummary, expectedSummary);
    assert.deepEqual(body.course.curriculum, expectedCurriculum);
    assert.deepEqual(grantLookups, []);
  });
});

test("an exact active enrollment grant grants the authenticated user curriculum titles", async () => {
  await withCourseApiFixture(1, async (grantLookups) => {
    const response = await getCourse(request({ id: "user-enrolled", role: "user" }), {
      params: { id: "course-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.course.curriculumLocked, false);
    assert.deepEqual(body.course.curriculumSummary, expectedSummary);
    assert.deepEqual(body.course.curriculum, expectedCurriculum);
    assert.deepEqual(grantLookups, [
      {
        where: {
          userId: "user-enrolled",
          courseId: "course-1",
          active: true,
        },
      },
    ]);
  });
});

test("authentication without an active enrollment grant keeps the item response locked and title-free", async () => {
  await withCourseApiFixture(0, async () => {
    const response = await getCourse(request({ id: "user-other", role: "user" }), {
      params: { id: "course-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assertLockedCourse(body.course);
  });
});

test("anonymous item responses are locked and contain no curriculum key or secret title", async () => {
  await withCourseApiFixture(0, async (grantLookups) => {
    const response = await getCourse(request(), { params: { id: "course-1" } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assertLockedCourse(body.course);
    assert.deepEqual(grantLookups, []);
  });
});

test("a revoked-only enrollment grant still keeps the curriculum locked while any active independent grant preserves access", async () => {
  await withCourseApiFixture(0, async () => {
    const response = await getCourse(request({ id: "user-revoked", role: "user" }), {
      params: { id: "course-1" },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assertLockedCourse(body.course);
  });
  await withCourseApiFixture(1, async () => {
    const response = await getCourse(request({ id: "user-kept", role: "user" }), {
      params: { id: "course-1" },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.course.curriculumLocked, false);
  });
});

test("SSR initial props and markup are always locked and title-free", async () => {
  const courseDelegate = prisma.course as unknown as {
    findFirst: (args: unknown) => Promise<unknown>;
  };
  const originalFindFirst = courseDelegate.findFirst;
  courseDelegate.findFirst = async () => courseFixture();
  try {
    const element = await CourseLayout({
      params: { slug: "public-course" },
      children: "Course page",
    });
    const serializedProps = JSON.stringify(element);
    const markup = renderToStaticMarkup(element);

    assert.equal(serializedProps.includes(SECRET_CHAPTER_TITLE), false);
    assert.equal(serializedProps.includes(SECRET_LESSON_TITLE), false);
    assert.equal(markup.includes(SECRET_CHAPTER_TITLE), false);
    assert.equal(markup.includes(SECRET_LESSON_TITLE), false);

    const course = (element as { props: { data: { course: Record<string, unknown> } } }).props
      .data.course;
    assertLockedCourse(course);
  } finally {
    courseDelegate.findFirst = originalFindFirst;
  }
});
