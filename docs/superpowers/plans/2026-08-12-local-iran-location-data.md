# Local Iran Location Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace runtime GitHub location lookups with validated repository snapshots and make province, city, Tehran district, and neighborhood selection reliable in every registration flow.

**Architecture:** Commit normalized JSON snapshots and expose them through the existing first-party API contracts. Keep large datasets server-only behind `lib/iran-locations.ts`; use a small client parser/request-owner module to validate responses and suppress stale province requests without bundling location data into the browser.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Node test runner through `tsx --test`, repository JSON snapshots.

## Global Constraints

- Production location routes perform no runtime network request and contain no GitHub Raw or Gist URL.
- Preserve `GET /api/locations` response contracts for province and city callers.
- Preserve `GET /api/tehran-neighborhoods` as `{ districts: Record<string, string[]> }`.
- Keep all current Iranian provinces and cities, with districts and neighborhoods only for Tehran city.
- Repository snapshots are immutable at runtime and updated only by reviewed commit and deployment.
- Invalid repository data fails tests/build rather than silently serving partial data.
- Browser consumers check `response.ok`, reject malformed shapes, clear dependent selections, and suppress stale province responses.
- Do not add database models, admin editing, automatic synchronization, or neighborhoods outside Tehran city.
- Preserve unrelated working-tree changes and stage only task files.

---

### Task 1: Validated Local Snapshots And First-Party APIs

**Files:**
- Create: `data/iran/provinces.json`
- Create: `data/iran/cities.json`
- Create: `data/iran/tehran-neighborhoods.json`
- Create: `data/iran/README.md`
- Create: `lib/iran-locations.ts`
- Modify: `app/api/locations/route.ts`
- Modify: `app/api/tehran-neighborhoods/route.ts`
- Create: `tests/iran-location-data.test.ts`

**Interfaces:**
- Produces: `ProvinceRecord`, `CityRecord`, `TehranDistricts`, `listProvinces()`, `listCitiesByProvinceId(provinceId)`, `getTehranDistricts()`, and `parseProvinceId(value)`.
- API output remains `{ provinces: ProvinceRecord[] }`, `{ cities: string[] }`, and `{ districts: TehranDistricts }`.

- [ ] Write failing tests that import `lib/iran-locations.ts`, replace `globalThis.fetch` with a function that throws, call both route handlers, and assert exact local API contracts without any network call.
- [ ] Add data-integrity tests asserting unique province IDs/names, every city references a province, non-empty duplicate-free city names per province, province `123` is `تهران`, province `123` includes city `تهران`, and every Tehran district/neighborhood is non-empty and duplicate-free.
- [ ] Add query tests asserting no `provinceId` returns provinces, `provinceId=123` returns Tehran cities, unknown integer returns `{ cities: [] }`, and `provinceId=abc` returns fixed Persian `400`.
- [ ] Run `npx tsx --test tests/iran-location-data.test.ts` and verify RED because local data/module do not exist and current routes call `fetch`.
- [ ] Snapshot the exact current sources documented in the existing routes: normalize province records to `{ id, name }`, city records from `{ name, province_id }` to `{ name, provinceId }`, and store the Tehran API's `districts` object directly. Preserve Persian strings exactly, format JSON deterministically, and record source URLs plus snapshot date `2026-08-12` in `data/iran/README.md`.
- [ ] Implement strict module initialization validation using plain arrays/objects, finite integer province IDs, trimmed non-empty strings, known province references, and duplicate rejection. Return defensive copies so route callers cannot mutate module-owned data.
- [ ] Replace both route-level external fetches with the local module. `parseProvinceId(null)` selects the province response; numeric integer IDs select cities; malformed values throw a controlled query error mapped to `{ error: "شناسه استان نامعتبر است" }` with status `400`.
- [ ] Run the focused test, `npx tsc --noEmit --incremental false`, and `git diff --check` sequentially.
- [ ] Commit with `feat: serve Iran locations from local data`.

### Task 2: Reliable Registration Location Consumers

**Files:**
- Create: `lib/iran-location-client.ts`
- Modify: `app/(site)/register/page.tsx`
- Modify: `components/ui/iran-location-fields.tsx`
- Modify: `components/courses/course-registration-modal.tsx`
- Create: `tests/iran-location-client.test.ts`

**Interfaces:**
- Consumes API contracts from Task 1.
- Produces `parseProvinceResponse(input)`, `parseCityResponse(input)`, `parseTehranDistrictResponse(input)`, `districtNames(districts)`, `neighborhoodNames(districts, district)`, and `createLocationRequestOwner()`.

- [ ] Write failing tests proving the current `{ districts: { districtName: string[] } }` response yields district names and neighborhoods without array `find/map`, malformed/error envelopes are rejected, and parser outputs are defensive copies.
- [ ] Write request-owner tests proving starting request B aborts request A, A cannot commit after B starts, current B can commit, and cleanup aborts B.
- [ ] Run `npx tsx --test tests/iran-location-client.test.ts` and verify RED because the client boundary does not exist.
- [ ] Implement strict client parsers accepting only the documented top-level keys and plain array/object values. Implement `createLocationRequestOwner` with one active `AbortController`, `start() -> { signal, isCurrent }`, and `cancel()`.
- [ ] Change standalone registration district state to `Record<string, string[]>`, render `districtNames(districts)`, and derive neighborhoods through `neighborhoodNames(districts, district)`.
- [ ] In standalone registration, use one owner for city loads, clear city/district/neighborhood before starting, check `response.ok`, parse through the client boundary, and commit only when `isCurrent()` remains true. Cancel on effect cleanup.
- [ ] Apply the same status, parser, abort, and latest-owner rules to `IranLocationFields`; loading belongs only to the current request so an aborted older request cannot clear a newer loading state.
- [ ] Parse the course modal's Tehran response through `parseTehranDistrictResponse`; on failure store `{}` and retain the existing UI without malformed data.
- [ ] Run focused client/data tests and full `npm test`, then run TypeScript, production build, and `git diff --check` sequentially.
- [ ] Commit with `fix: make Iran location selection reliable`.

### Task 3: Dependency Audit And Production Verification

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes committed local snapshots and hardened consumers.
- Produces verified deployment with no runtime external location dependency.

- [ ] Inspect `git status`, the complete branch diff, and recent commits; confirm unrelated local files remain unstaged.
- [ ] Search production source for `raw.githubusercontent.com`, the Tehran Gist identifier, and the old location source URLs; assert no runtime location code contains them while `data/iran/README.md` retains provenance only.
- [ ] Run fresh `npm test`, `npx tsc --noEmit --incremental false`, `npm run build`, and branch-wide `git diff --check` sequentially.
- [ ] Push `master` and execute `/var/www/Emroschool/deploy-safe.sh` through `bash` on the VPS.
- [ ] Verify production commit, PM2 online status, and HTTP `200` for `/register`, `/api/locations`, `/api/locations?provinceId=123`, and `/api/tehran-neighborhoods`.
- [ ] Assert production location responses match local contracts, malformed `provinceId` returns fixed `400`, and Tehran data supports one complete district-to-neighborhood projection.
- [ ] Exercise standalone registration and course registration with Tehran plus one non-Tehran province; verify no browser crash, no stale city overwrite under rapid province switching, and successful details submission.
- [ ] Inspect production application/network logs and confirm location requests target only the first-party domain and no relevant `500`/`502` occurs.
