import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

import { PUT } from "../app/api/courses/[id]/route";
import { POST } from "../app/api/courses/route";
import { generateToken } from "../lib/auth";

const execFileAsync = promisify(execFile);
const authorize = async () => ({
  id: "admin-1",
  email: "admin@example.com",
  role: "admin",
});
let directory: string;
let db: PrismaClient;

function request(method: "POST" | "PUT", body: Record<string, unknown>, authenticated = true) {
  const token = authenticated
    ? generateToken({ id: "admin-1", email: "admin@example.com", role: "admin" })
    : null;
  return new NextRequest("http://localhost/api/courses/route-course", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function createCourse(id: string) {
  return db.course.create({
    data: {
      id,
      title: `Course ${id}`,
      slug: `course-${id}`,
      description: "Route integration test",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
    },
  });
}

test.before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "course-curriculum-routes-"));
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

test("course writes reject unauthenticated requests before database access", async () => {
  const inaccessibleDb = new Proxy({}, { get: () => assert.fail("database must not be read") });
  const postResponse = await POST(request("POST", {}, false), { params: {} }, { db: inaccessibleDb as never });
  const putResponse = await PUT(
    request("PUT", {}, false),
    { params: { id: "missing" } },
    { db: inaccessibleDb as never },
  );

  assert.equal(postResponse.status, 403);
  assert.equal(putResponse.status, 403);
  assert.deepEqual(await postResponse.json(), { error: "دسترسی غیرمجاز" });
  assert.deepEqual(await putResponse.json(), { error: "دسترسی غیرمجاز" });
});

test("invalid curriculum duration and title return the fixed Persian 400 before transaction", async () => {
  let transactions = 0;
  const transactionGuard = {
    $transaction() {
      transactions += 1;
      assert.fail("invalid curriculum must not start a transaction");
    },
  };
  const base = {
    title: "Course",
    slug: "route-invalid",
    description: "Description",
    courseType: "single",
    scheduleStatus: "upcoming",
    startDate: "2026-09-01T00:00:00.000Z",
  };
  const invalidDuration = await POST(
    request("POST", {
      ...base,
      curriculum: [
        {
          title: "Chapter",
          lessons: [{ title: "Lesson", durationMinutes: 2_147_483_648 }],
        },
      ],
    }),
    { params: {} },
    { db: transactionGuard as never, authorize },
  );
  const invalidTitle = await POST(
    request("POST", {
      ...base,
      curriculum: [{ title: " ", lessons: [] }],
    }),
    { params: {} },
    { db: transactionGuard as never, authorize },
  );

  assert.equal(invalidDuration.status, 400);
  assert.equal(invalidTitle.status, 400);
  assert.deepEqual(await invalidDuration.json(), {
    error: "ساختار سرفصل‌های دوره نامعتبر است",
  });
  assert.deepEqual(await invalidTitle.json(), {
    error: "ساختار سرفصل‌های دوره نامعتبر است",
  });
  assert.equal(transactions, 0);
});

test("foreign curriculum IDs return a detail-free Persian 409 and roll back the course update", async () => {
  await createCourse("owner-a");
  await createCourse("owner-b");
  await db.courseChapter.create({
    data: { id: "chapter-a", title: "Original", courseId: "owner-a" },
  });
  await db.courseChapter.create({
    data: { id: "chapter-b", title: "Private foreign title", courseId: "owner-b" },
  });

  const response = await PUT(
    request("PUT", {
      title: "Must roll back",
      curriculum: [{ id: "chapter-b", title: "Stolen", lessons: [] }],
    }),
    { params: { id: "owner-a" } },
    { db, authorize },
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.deepEqual(body, { error: "شناسه سرفصل یا درس متعلق به این دوره نیست" });
  assert.equal(JSON.stringify(body).includes("Private foreign title"), false);
  assert.equal((await db.course.findUniqueOrThrow({ where: { id: "owner-a" } })).title, "Course owner-a");
  assert.equal((await db.courseChapter.findUniqueOrThrow({ where: { id: "chapter-a" } })).title, "Original");
});

test("omitted curriculum preserves rows while explicit empty curriculum deletes them transactionally", async () => {
  await createCourse("dispatch");
  await db.courseChapter.create({
    data: {
      id: "chapter-dispatch",
      title: "Keep unless explicitly cleared",
      courseId: "dispatch",
      lessons: { create: { id: "lesson-dispatch", title: "Lesson" } },
    },
  });

  const omitted = await PUT(
    request("PUT", { title: "Omitted update" }),
    { params: { id: "dispatch" } },
    { db, authorize },
  );
  assert.equal(omitted.status, 200);
  assert.equal(await db.courseChapter.count({ where: { courseId: "dispatch" } }), 1);

  const explicitEmpty = await PUT(
    request("PUT", { curriculum: [] }),
    { params: { id: "dispatch" } },
    { db, authorize },
  );
  assert.equal(explicitEmpty.status, 200);
  assert.equal(await db.courseChapter.count({ where: { courseId: "dispatch" } }), 0);
  assert.equal(await db.courseLesson.count(), 0);
});
