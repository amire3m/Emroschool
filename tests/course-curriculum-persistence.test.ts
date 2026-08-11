import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

import * as curriculumModule from "../lib/course-curriculum";
import { normalizeCurriculum } from "../lib/course-curriculum";

const execFileAsync = promisify(execFile);
type SyncCourseCurriculum = (
  tx: unknown,
  courseId: string,
  curriculum: ReturnType<typeof normalizeCurriculum>,
) => Promise<void>;

let directory: string;
let db: PrismaClient;

function syncCourseCurriculum(...args: Parameters<SyncCourseCurriculum>) {
  const candidate = (curriculumModule as unknown as {
    syncCourseCurriculum?: SyncCourseCurriculum;
  }).syncCourseCurriculum;
  if (typeof candidate !== "function") {
    assert.fail("syncCourseCurriculum must be exported");
  }
  return candidate(...args);
}

async function createCourse(id: string) {
  return db.course.create({
    data: {
      id,
      title: `Course ${id}`,
      slug: `course-${id}`,
      description: "Persistence test",
    },
  });
}

test.before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "course-curriculum-"));
  const databasePath = path.join(directory, "integration.db");
  const databaseUrl = `file:${databasePath.replace(/\\/g, "/")}`;
  const schemaPath = path.join(directory, "schema.prisma");
  const schema = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  await writeFile(
    schemaPath,
    schema.replace('url      = "file:./dev.db"', 'url      = "file:./integration.db"'),
  );
  await execFileAsync(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--schema",
      schemaPath,
      "--skip-generate",
      "--accept-data-loss",
    ],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
});

test.beforeEach(async () => {
  await db.course.deleteMany();
});

test.after(async () => {
  await db.$disconnect();
  await rm(directory, { recursive: true, force: true });
});

test("creates nested chapters and lessons in normalized order", async () => {
  await createCourse("nested");

  await db.$transaction((tx) =>
    syncCourseCurriculum(
      tx,
      "nested",
      normalizeCurriculum([
        {
          title: " Foundations ",
          lessons: [
            { title: "First", durationMinutes: 12 },
            { title: "Second" },
          ],
        },
        { title: "Practice", lessons: [{ title: "Third", durationMinutes: 8 }] },
      ]),
    ),
  );

  const chapters = await db.courseChapter.findMany({
    where: { courseId: "nested" },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  assert.deepEqual(
    chapters.map((chapter) => ({
      title: chapter.title,
      order: chapter.order,
      lessons: chapter.lessons.map((lesson) => ({
        title: lesson.title,
        durationMinutes: lesson.durationMinutes,
        order: lesson.order,
      })),
    })),
    [
      {
        title: "Foundations",
        order: 0,
        lessons: [
          { title: "First", durationMinutes: 12, order: 0 },
          { title: "Second", durationMinutes: null, order: 1 },
        ],
      },
      {
        title: "Practice",
        order: 1,
        lessons: [{ title: "Third", durationMinutes: 8, order: 0 }],
      },
    ],
  );
});

test("updates owned rows while preserving their stable IDs", async () => {
  await createCourse("stable");
  await db.courseChapter.create({
    data: {
      id: "chapter-stable",
      title: "Old chapter",
      courseId: "stable",
      lessons: {
        create: {
          id: "lesson-stable",
          title: "Old lesson",
          durationMinutes: 5,
        },
      },
    },
  });

  await db.$transaction((tx) =>
    syncCourseCurriculum(
      tx,
      "stable",
      normalizeCurriculum([
        {
          id: "chapter-stable",
          title: "New chapter",
          lessons: [
            {
              id: "lesson-stable",
              title: "New lesson",
              durationMinutes: 20,
            },
          ],
        },
      ]),
    ),
  );

  const chapter = await db.courseChapter.findUniqueOrThrow({
    where: { id: "chapter-stable" },
    include: { lessons: true },
  });
  assert.equal(chapter.id, "chapter-stable");
  assert.equal(chapter.title, "New chapter");
  assert.equal(chapter.lessons[0].id, "lesson-stable");
  assert.equal(chapter.lessons[0].title, "New lesson");
  assert.equal(chapter.lessons[0].durationMinutes, 20);
});

test("deletes chapters and lessons omitted from the supplied curriculum", async () => {
  await createCourse("omitted");
  await db.courseChapter.create({
    data: {
      id: "chapter-kept",
      title: "Keep",
      courseId: "omitted",
      lessons: {
        create: [
          { id: "lesson-kept", title: "Keep" },
          { id: "lesson-omitted", title: "Remove" },
        ],
      },
    },
  });
  await db.courseChapter.create({
    data: {
      id: "chapter-omitted",
      title: "Remove",
      courseId: "omitted",
      lessons: { create: { id: "lesson-cascaded", title: "Remove" } },
    },
  });

  await db.$transaction((tx) =>
    syncCourseCurriculum(
      tx,
      "omitted",
      normalizeCurriculum([
        {
          id: "chapter-kept",
          title: "Keep",
          lessons: [{ id: "lesson-kept", title: "Keep" }],
        },
      ]),
    ),
  );

  assert.deepEqual(
    (await db.courseChapter.findMany({ where: { courseId: "omitted" } })).map(({ id }) => id),
    ["chapter-kept"],
  );
  assert.deepEqual(
    (await db.courseLesson.findMany()).map(({ id }) => id),
    ["lesson-kept"],
  );
});

test("an explicitly empty curriculum deletes every chapter and lesson", async () => {
  await createCourse("empty");
  await db.courseChapter.create({
    data: {
      id: "chapter-empty",
      title: "Remove",
      courseId: "empty",
      lessons: { create: { id: "lesson-empty", title: "Remove" } },
    },
  });

  await db.$transaction((tx) =>
    syncCourseCurriculum(tx, "empty", normalizeCurriculum([])),
  );

  assert.equal(await db.courseChapter.count({ where: { courseId: "empty" } }), 0);
  assert.equal(await db.courseLesson.count(), 0);
});

test("course deletion cascades through persisted chapters and lessons", async () => {
  await createCourse("cascade");
  await db.$transaction((tx) =>
    syncCourseCurriculum(
      tx,
      "cascade",
      normalizeCurriculum([
        { title: "Chapter", lessons: [{ title: "Lesson" }] },
      ]),
    ),
  );

  await db.course.delete({ where: { id: "cascade" } });

  assert.equal(await db.courseChapter.count(), 0);
  assert.equal(await db.courseLesson.count(), 0);
});

test("rejects a foreign chapter ID before mutating owned curriculum", async () => {
  await createCourse("owner-a");
  await createCourse("owner-b");
  await db.courseChapter.create({
    data: { id: "chapter-a", title: "Original", courseId: "owner-a" },
  });
  await db.courseChapter.create({
    data: { id: "chapter-b", title: "Foreign", courseId: "owner-b" },
  });

  await assert.rejects(
    () =>
      db.$transaction((tx) =>
        syncCourseCurriculum(
          tx,
          "owner-a",
          normalizeCurriculum([
            { id: "chapter-a", title: "Mutated", lessons: [] },
            { id: "chapter-b", title: "Stolen", lessons: [] },
          ]),
        ),
      ),
    (error: unknown) =>
      (error as { code?: unknown }).code === "COURSE_CURRICULUM_OWNERSHIP",
  );

  assert.equal(
    (await db.courseChapter.findUniqueOrThrow({ where: { id: "chapter-a" } })).title,
    "Original",
  );
  assert.equal(await db.courseChapter.count({ where: { courseId: "owner-a" } }), 1);
});

test("rejects a foreign lesson ID before mutating owned curriculum", async () => {
  await createCourse("lesson-owner-a");
  await createCourse("lesson-owner-b");
  await db.courseChapter.create({
    data: {
      id: "lesson-chapter-a",
      title: "Original",
      courseId: "lesson-owner-a",
      lessons: { create: { id: "lesson-a", title: "Original" } },
    },
  });
  await db.courseChapter.create({
    data: {
      id: "lesson-chapter-b",
      title: "Foreign",
      courseId: "lesson-owner-b",
      lessons: { create: { id: "lesson-b", title: "Foreign" } },
    },
  });

  await assert.rejects(
    () =>
      db.$transaction((tx) =>
        syncCourseCurriculum(
          tx,
          "lesson-owner-a",
          normalizeCurriculum([
            {
              id: "lesson-chapter-a",
              title: "Mutated",
              lessons: [{ id: "lesson-b", title: "Stolen" }],
            },
          ]),
        ),
      ),
    (error: unknown) =>
      (error as { code?: unknown }).code === "COURSE_CURRICULUM_OWNERSHIP",
  );

  const chapter = await db.courseChapter.findUniqueOrThrow({
    where: { id: "lesson-chapter-a" },
    include: { lessons: true },
  });
  assert.equal(chapter.title, "Original");
  assert.deepEqual(chapter.lessons.map(({ id, title }) => ({ id, title })), [
    { id: "lesson-a", title: "Original" },
  ]);
});

test("rolls curriculum reconciliation back with the surrounding transaction", async () => {
  await createCourse("rollback");
  await db.courseChapter.create({
    data: { id: "chapter-rollback", title: "Original", courseId: "rollback" },
  });

  await assert.rejects(
    () =>
      db.$transaction(async (tx) => {
        await syncCourseCurriculum(
          tx,
          "rollback",
          normalizeCurriculum([{ title: "Replacement", lessons: [{ title: "New" }] }]),
        );
        throw new Error("force rollback");
      }),
    (error: unknown) => error instanceof Error && error.message === "force rollback",
  );

  const chapters = await db.courseChapter.findMany({ where: { courseId: "rollback" } });
  assert.deepEqual(chapters.map(({ id, title }) => ({ id, title })), [
    { id: "chapter-rollback", title: "Original" },
  ]);
  assert.equal(await db.courseLesson.count(), 0);
});

test("rewrites chapter and lesson order to gapless input positions", async () => {
  await createCourse("reorder");
  await db.courseChapter.create({
    data: {
      id: "chapter-first",
      title: "First",
      order: 10,
      courseId: "reorder",
      lessons: {
        create: [
          { id: "lesson-first", title: "First", order: 20 },
          { id: "lesson-second", title: "Second", order: 10 },
        ],
      },
    },
  });
  await db.courseChapter.create({
    data: { id: "chapter-second", title: "Second", order: 20, courseId: "reorder" },
  });

  await db.$transaction((tx) =>
    syncCourseCurriculum(
      tx,
      "reorder",
      normalizeCurriculum([
        { id: "chapter-second", title: "Second", lessons: [] },
        {
          id: "chapter-first",
          title: "First",
          lessons: [
            { id: "lesson-second", title: "Second" },
            { id: "lesson-first", title: "First" },
          ],
        },
      ]),
    ),
  );

  const chapters = await db.courseChapter.findMany({
    where: { courseId: "reorder" },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  assert.deepEqual(
    chapters.map(({ id, order, lessons }) => ({
      id,
      order,
      lessons: lessons.map(({ id: lessonId, order: lessonOrder }) => ({
        id: lessonId,
        order: lessonOrder,
      })),
    })),
    [
      { id: "chapter-second", order: 0, lessons: [] },
      {
        id: "chapter-first",
        order: 1,
        lessons: [
          { id: "lesson-second", order: 0 },
          { id: "lesson-first", order: 1 },
        ],
      },
    ],
  );
});

test("touches the parent course updatedAt in the same transaction", async () => {
  await createCourse("touch");
  const oldUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
  await db.course.update({ where: { id: "touch" }, data: { updatedAt: oldUpdatedAt } });

  await db.$transaction((tx) =>
    syncCourseCurriculum(
      tx,
      "touch",
      normalizeCurriculum([{ title: "Chapter", lessons: [] }]),
    ),
  );

  const course = await db.course.findUniqueOrThrow({ where: { id: "touch" } });
  assert.ok(course.updatedAt.getTime() > oldUpdatedAt.getTime());
});
