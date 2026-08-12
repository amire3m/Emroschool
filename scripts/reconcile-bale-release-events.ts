import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { releaseEventKey } from "../lib/bale-group-notifications";
import { APP_VERSION, ReleaseNote, releaseNotes } from "../lib/version";

type ReleaseEventDatabase = Pick<PrismaClient, "baleGroupEvent">;

export async function reconcileBaleReleaseEvents(
  db: ReleaseEventDatabase,
  now = new Date(),
  options: { notes?: ReleaseNote[]; appVersion?: string } = {},
) {
  const notes = [...(options.notes ?? releaseNotes)].sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
  );
  const releaseCards = notes.filter((note) => note.type === "release");
  const releases = releaseCards.filter((note) => note.version === (options.appVersion ?? APP_VERSION));
  let queued = 0;

  for (const release of releases) {
    const releaseIndex = releaseCards.indexOf(release);
    const precedingRelease = releaseCards[releaseIndex + 1];
    const upperBound = Date.parse(release.publishedAt);
    const lowerBound = precedingRelease ? Date.parse(precedingRelease.publishedAt) : Number.NEGATIVE_INFINITY;
    const capabilities = notes
      .filter((note) => note.type !== "release")
      .filter((note) => {
        const publishedAt = Date.parse(note.publishedAt);
        return publishedAt > lowerBound && publishedAt <= upperBound;
      })
      .map((note) => note.title);

    const eventKey = releaseEventKey(release.id);
    try {
      await db.baleGroupEvent.create({
        data: {
          eventKey,
          type: "release",
          payload: JSON.stringify({
            version: release.version!,
            title: release.title,
            publishedAt: release.publishedAt,
            capabilities,
          }),
          nextAttemptAt: now,
        },
      });
      queued += 1;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
    }
  }

  return { releases: releases.length, queued };
}

export function isDirectExecution(moduleUrl: string, entryPath = process.argv[1]) {
  return Boolean(entryPath) && path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

async function main() {
  const db = new PrismaClient();
  try {
    console.log(JSON.stringify(await reconcileBaleReleaseEvents(db)));
  } finally {
    await db.$disconnect();
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch(() => {
    console.error("BALE_RELEASE_RECONCILIATION_FAILED");
    process.exitCode = 1;
  });
}
