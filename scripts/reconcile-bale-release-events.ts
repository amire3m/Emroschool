import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { releaseEventKey } from "../lib/bale-group-notifications";
import { APP_VERSION, releaseNotes } from "../lib/version";

type ReleaseEventDatabase = Pick<PrismaClient, "baleGroupEvent">;

export async function reconcileBaleReleaseEvents(db: ReleaseEventDatabase, now = new Date()) {
  const versionedCards = releaseNotes.filter((note) => Boolean(note.version));
  const releases = versionedCards.filter((note) => note.type === "release" && note.version === APP_VERSION);
  let queued = 0;

  for (const release of releases) {
    const releaseIndex = versionedCards.indexOf(release);
    const precedingRelease = versionedCards[releaseIndex + 1];
    const upperBound = Date.parse(release.publishedAt);
    const lowerBound = precedingRelease ? Date.parse(precedingRelease.publishedAt) : Number.NEGATIVE_INFINITY;
    const capabilities = releaseNotes
      .filter((note) => !note.version)
      .filter((note) => {
        const publishedAt = Date.parse(note.publishedAt);
        return publishedAt > lowerBound && publishedAt <= upperBound;
      })
      .map((note) => note.title);

    const eventKey = releaseEventKey(release.id);
    const existing = await db.baleGroupEvent.findUnique({ where: { eventKey }, select: { id: true } });
    await db.baleGroupEvent.upsert({
      where: { eventKey },
      update: {},
      create: {
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
    if (!existing) queued += 1;
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
