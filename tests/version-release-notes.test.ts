import assert from "node:assert/strict";
import test from "node:test";

import { APP_VERSION, releaseNotes } from "../lib/version";

const approvedCapabilities = {
  "local-iran-location-data": ["2026-08-12T03:17:02+03:30", "fix"],
  "protected-course-curriculum": ["2026-08-11T12:31:09+03:30", "feature"],
  "reliable-bale-payments": ["2026-08-11T02:28:01+03:30", "improvement"],
  "search-indexing-and-course-ssr": ["2026-08-10T02:02:19+03:30", "improvement"],
  "homepage-registration-path": ["2026-08-10T01:31:24+03:30", "improvement"],
  "payer-card-security": ["2026-08-08T04:21:36+03:30", "feature"],
  "organized-user-files": ["2026-08-08T03:23:47+03:30", "improvement"],
  "admin-dashboard-reports": ["2026-08-08T03:04:05+03:30", "feature"],
  "google-account-onboarding": ["2026-08-08T02:25:57+03:30", "improvement"],
  "multi-step-registration": ["2026-08-08T01:22:36+03:30", "feature"],
  "homepage-performance-accessibility": ["2026-08-07T19:10:03+03:30", "improvement"],
  "change-payment-method": ["2026-08-07T13:41:03+03:30", "feature"],
  "admin-user-management-history": ["2026-08-04T19:34:30+03:30", "feature"],
  "support-ticket-system": ["2026-08-04T18:07:23+03:30", "feature"],
  "profile-review-workflow": ["2026-08-04T17:39:36+03:30", "feature"],
  "registration-result-notification": ["2026-08-03T16:51:44+03:30", "improvement"],
  "standalone-discount-codes": ["2026-08-03T15:49:41+03:30", "feature"],
  "pending-application-review": ["2026-08-03T14:51:33+03:30", "improvement"],
} as const;

const historicalIds = [
  "configurable-registration-forms",
  "unified-course-registration-payment",
  "course-management-selection-improvements",
  "course-management-and-student-controls",
  "safe-user-deletion-controls",
  "public-privacy-policy-page",
  "remove-temporary-oauth-branding-pages",
  "unique-google-oauth-brand-identity",
  "public-privacy-policy-for-google-oauth",
  "root-home-english-oauth-branding",
  "english-google-oauth-branding-page",
  "google-oauth-purpose-disclosure",
  "oauth-branding-home-purpose",
  "google-oauth-login",
  "google-indexing-sitemap-and-robots",
  "attach-existing-courses-to-collection",
  "add-child-courses-from-parent",
  "comprehensive-course-collection-experience",
  "two-line-admin-content-urls",
  "admin-content-link-controls",
  "content-permalink-copy-controls",
  "animated-global-error-pages",
  "restore-newsletter-section-order",
  "interactive-home-course-button",
  "welcome-newsletter-admin-email-tools",
  "about-contact-page-and-footer-address",
  "footer-social-icons-and-font-weights",
  "registration-form-fields-and-course-price-visibility",
  "instant-auth-navbar-and-dashboard-spacing",
  "local-postfix-email-relay",
  "optional-email-verification",
  "email-verification-and-admin-passwords",
  "gallery-metadata-simplification",
  "gallery-seo-persian-dates-and-site-polish",
  "partners-navigation-and-footer-map",
  "course-hierarchy-and-registration-applications",
  "topbar-typography-logo-crop",
  "new-font-library-and-ravagh",
  "magazine-font-setting",
  "independent-magazine-platform",
  "academy-magazine-publishing-flow",
  "news-site-editor-and-interactions",
  "news-magazine-and-global-search",
  "animated-header-search",
  "safe-file-renaming-and-header-logo",
  "upload-errors-and-formats",
  "file-upload-progress",
  "admin-navigation-groups",
  "department-glow-readability",
  "department-glow-effect",
  "version-2",
  "image-editor",
  "homepage-carousels",
  "file-manager",
  "course-categories",
  "profiles-and-settings",
] as const;

test("publishes the complete version 2.2 update set", () => {
  assert.equal(APP_VERSION, "2.2.0");

  const releaseCards = releaseNotes.filter((note) => note.id === "version-2-2");
  assert.equal(releaseCards.length, 1);
  assert.equal(releaseCards[0].type, "release");
  assert.equal(releaseCards[0].version, APP_VERSION);
  assert.equal(releaseCards[0].publishedAt, "2026-08-12T11:51:01+03:30");

  for (const [id, [publishedAt, type]] of Object.entries(approvedCapabilities)) {
    const cards = releaseNotes.filter((note) => note.id === id);
    assert.equal(cards.length, 1, id);
    assert.equal(cards[0].publishedAt, publishedAt, id);
    assert.equal(cards[0].type, type, id);
  }
});

test("keeps release notes valid, unique, and sorted newest first", () => {
  assert.equal(releaseNotes.length, 75);

  const ids = releaseNotes.map((note) => note.id);
  assert.equal(new Set(ids).size, ids.length);

  const allowedTypes = new Set(["release", "feature", "improvement", "fix"]);
  for (const note of releaseNotes) {
    assert.equal(note.id.trim(), note.id);
    assert.notEqual(note.title.trim(), "");
    assert.notEqual(note.summary.trim(), "");
    assert.equal(allowedTypes.has(note.type), true, note.id);
    assert.match(note.publishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:30$/);
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

test("keeps historical release versions independent from the current version", () => {
  const approvedIds = new Set(["version-2-2", ...Object.keys(approvedCapabilities)]);
  const exportedHistoricalIds = releaseNotes
    .map((note) => note.id)
    .filter((id) => !approvedIds.has(id))
    .sort();
  assert.deepEqual(exportedHistoricalIds, [...historicalIds].sort());

  const historicalVersion = releaseNotes.find((note) => note.id === "version-2");
  assert.ok(historicalVersion);
  assert.equal(historicalVersion.version, "2.0.0");
});

test("retains the approved Tehran and Bale release facts", () => {
  const locations = releaseNotes.find((note) => note.id === "local-iran-location-data");
  const bale = releaseNotes.find((note) => note.id === "reliable-bale-payments");
  assert.ok(locations);
  assert.ok(bale);
  assert.match(locations.summary, /محله تهران.*الزامی/);
  assert.match(bale.summary, /تلاش پرداخت.*سامانه/);
  assert.match(bale.summary, /شواهد نامطمئن/);
});
