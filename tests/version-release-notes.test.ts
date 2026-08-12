import assert from "node:assert/strict";
import test from "node:test";

import { APP_VERSION, releaseNotes } from "../lib/version";

const approvedCapabilityIds = [
  "local-iran-location-data",
  "protected-course-curriculum",
  "reliable-bale-payments",
  "search-indexing-and-course-ssr",
  "homepage-registration-path",
  "payer-card-security",
  "organized-user-files",
  "admin-dashboard-reports",
  "google-account-onboarding",
  "multi-step-registration",
  "homepage-performance-accessibility",
  "change-payment-method",
  "admin-user-management-history",
  "support-ticket-system",
  "profile-review-workflow",
  "registration-result-notification",
  "standalone-discount-codes",
  "pending-application-review",
] as const;

test("publishes the complete version 2.2 update set", () => {
  assert.equal(APP_VERSION, "2.2.0");

  const releaseCards = releaseNotes.filter((note) => note.id === "version-2-2");
  assert.equal(releaseCards.length, 1);
  assert.equal(releaseCards[0].type, "release");
  assert.equal(releaseCards[0].version, APP_VERSION);

  for (const id of approvedCapabilityIds) {
    assert.equal(releaseNotes.filter((note) => note.id === id).length, 1, id);
  }
});

test("keeps release notes valid, unique, and sorted newest first", () => {
  const ids = releaseNotes.map((note) => note.id);
  assert.equal(new Set(ids).size, ids.length);

  const allowedTypes = new Set(["release", "feature", "improvement", "fix"]);
  for (const note of releaseNotes) {
    assert.equal(note.id.trim(), note.id);
    assert.notEqual(note.title.trim(), "");
    assert.notEqual(note.summary.trim(), "");
    assert.equal(allowedTypes.has(note.type), true, note.id);
    assert.match(
      note.publishedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/,
    );
    assert.equal(Number.isNaN(Date.parse(note.publishedAt)), false, note.id);
  }

  for (let index = 1; index < releaseNotes.length; index += 1) {
    assert.ok(
      Date.parse(releaseNotes[index - 1].publishedAt) >=
        Date.parse(releaseNotes[index].publishedAt),
      `${releaseNotes[index - 1].id} must not precede ${releaseNotes[index].id}`,
    );
  }
});
