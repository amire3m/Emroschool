# Local Iran Location Data Design

## Goal

Remove every runtime dependency on GitHub for Iranian province, city, Tehran district, and Tehran neighborhood data while preserving current application API contracts and fixing the Tehran selection crash in standalone registration.

## Scope

- Keep all Iranian provinces and cities currently supplied by the existing GitHub dataset.
- Keep district and neighborhood data for Tehran city only, matching current product behavior.
- Store immutable snapshots in the repository and update them only through reviewed commits and deployments.
- Preserve `/api/locations` and `/api/tehran-neighborhoods` so existing browser consumers do not need a transport redesign.
- Fix response validation, stale province-request handling, and the incompatible Tehran response shape in the registration page.
- Do not add database tables, admin editing, runtime synchronization, or neighborhood data for other cities.

## Architecture

Repository-owned JSON snapshots become the only source of location data:

- `data/iran/provinces.json`: ordered `{ id, name }` province records.
- `data/iran/cities.json`: `{ name, provinceId }` city records using the normalized camel-case field.
- `data/iran/tehran-neighborhoods.json`: district-name keys mapped to neighborhood-name arrays.
- `data/iran/README.md`: source URLs, snapshot date, original field mapping, update procedure, and integrity expectations.

`lib/iran-locations.ts` owns typed parsing and projections. API routes call this module and never call `fetch`. Browser components continue calling first-party APIs, which keeps the full city and neighborhood datasets out of client bundles.

## API Contracts

### `GET /api/locations`

Without `provinceId`, return:

```json
{ "provinces": [{ "id": 123, "name": "تهران" }] }
```

With a valid `provinceId`, return unique locale-sorted city names:

```json
{ "cities": ["آبسرد", "تهران"] }
```

An absent or unknown numeric province ID returns an empty `cities` array, preserving current behavior. A malformed non-numeric ID returns a fixed Persian `400` response.

### `GET /api/tehran-neighborhoods`

Return the existing object contract:

```json
{ "districts": { "منطقه ۱ شهر تهران": ["تجریش"] } }
```

The route never performs network I/O and cannot return an upstream `502`.

## Registration Fix

The standalone registration page must model Tehran data as `Record<string, string[]>`, matching the API and the working course-registration modal. District options come from `Object.keys(districts)` and neighborhood options come from `districts[selectedDistrict]`.

Province changes clear city, district, and neighborhood immediately. City requests use an `AbortController` and an ownership guard so a slower response for an older province cannot overwrite the current province. Every first-party fetch checks `response.ok` and validates the expected top-level shape before updating state.

The shared course location selector receives the same response-status and stale-request hardening. The course-registration modal validates the Tehran object response before storing it.

## Data Integrity

Automated tests must prove:

- Exactly one province ID and name per province.
- Every city references an existing province.
- City names are non-empty and duplicate-free within a province.
- Tehran province ID remains present and has Tehran city.
- Tehran districts are non-empty, unique keys with non-empty, duplicate-free neighborhoods.
- API routes return the existing contracts and make no network requests.
- The registration district/neighborhood projection accepts the object contract and cannot call array methods on it.
- Rapid province changes cannot commit stale city results.
- Production source contains no runtime GitHub/Gist URL for location data.

Malformed repository snapshots are build/test failures, not runtime fallbacks. We do not silently serve partial location data.

## Error Handling

- Local API reads are deterministic and normally return `200`.
- Malformed query input returns fixed Persian `400` without stack details.
- Browser consumers preserve the current selection UI, show a Persian retrieval error, and retain no stale dependent selection after a failed request.
- No consumer treats a non-2xx JSON error envelope as valid location data.

## Deployment And Verification

Run focused location tests, the full test suite, TypeScript, production build, and branch diff checks. After deployment, verify province and city responses, Tehran object shape, standalone Tehran registration interaction, course registration location interaction, no external location requests in server logs/network inspection, and healthy PM2/HTTP status.

## Data Updates

Future changes are manual and reviewable:

1. Retrieve candidate upstream data outside application runtime.
2. Normalize it to repository schemas.
3. Review the JSON diff and source metadata.
4. Run integrity and API contract tests.
5. Commit and deploy normally.

The production application never refreshes these snapshots automatically.
