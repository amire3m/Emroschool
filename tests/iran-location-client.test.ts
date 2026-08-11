import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocationRequestOwner,
  districtNames,
  neighborhoodNames,
  parseCityResponse,
  parseProvinceResponse,
  parseTehranDistrictResponse,
  readLocationResponse,
  startLocationLoad,
} from "../lib/iran-location-client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function response(ok: boolean, body: unknown) {
  return { ok, json: async () => body };
}

test("parses the documented location responses", () => {
  assert.deepEqual(
    parseProvinceResponse({ provinces: [{ id: 8, name: "تهران" }] }),
    [{ id: 8, name: "تهران" }],
  );
  assert.deepEqual(parseCityResponse({ cities: ["تهران", "ری"] }), ["تهران", "ری"]);

  const districts = parseTehranDistrictResponse({
    districts: {
      "منطقه ۱ شهر تهران": ["تجریش", "نیاوران"],
      "منطقه ۲ شهر تهران": [],
    },
  });
  assert.deepEqual(districtNames(districts), [
    "منطقه ۱ شهر تهران",
    "منطقه ۲ شهر تهران",
  ]);
  assert.deepEqual(neighborhoodNames(districts, "منطقه ۱ شهر تهران"), [
    "تجریش",
    "نیاوران",
  ]);
  assert.deepEqual(neighborhoodNames(districts, "ناشناخته"), []);
});

test("rejects malformed values, extra keys, blanks, duplicates, and error envelopes", () => {
  class NonPlainNames extends Array<string> {}
  const malformed: Array<() => unknown> = [
    () => parseProvinceResponse(null),
    () => parseProvinceResponse({ error: "failed" }),
    () => parseProvinceResponse({ provinces: [], extra: true }),
    () => parseProvinceResponse({ provinces: [{ id: 1, name: "تهران", extra: true }] }),
    () => parseProvinceResponse({ provinces: [{ id: 0, name: "تهران" }] }),
    () => parseProvinceResponse({ provinces: [{ id: 1, name: " " }] }),
    () => parseProvinceResponse({ provinces: [{ id: 1, name: "تهران" }, { id: 1, name: "البرز" }] }),
    () => parseProvinceResponse({ provinces: [{ id: 1, name: "تهران" }, { id: 2, name: "تهران" }] }),
    () => parseCityResponse({ cities: "تهران" }),
    () => parseCityResponse({ cities: new NonPlainNames("تهران") }),
    () => parseCityResponse({ cities: ["تهران", ""] }),
    () => parseCityResponse({ cities: ["تهران", "تهران"] }),
    () => parseCityResponse({ cities: [], error: "failed" }),
    () => parseTehranDistrictResponse({ districts: [] }),
    () => parseTehranDistrictResponse({ districts: { " ": [] } }),
    () => parseTehranDistrictResponse({ districts: { "منطقه ۱": ["تجریش", "تجریش"] } }),
    () => parseTehranDistrictResponse({ districts: { "منطقه ۱": [" "] } }),
    () => parseTehranDistrictResponse({ error: "failed" }),
  ];

  for (const parse of malformed) assert.throws(parse, TypeError);
});

test("returns deep defensive copies from parsers and district accessors", () => {
  const provinceInput = { provinces: [{ id: 8, name: "تهران" }] };
  const cityInput = { cities: ["تهران"] };
  const districtInput = { districts: { "منطقه ۱": ["تجریش"] } };

  const provinces = parseProvinceResponse(provinceInput);
  const cities = parseCityResponse(cityInput);
  const districts = parseTehranDistrictResponse(districtInput);
  const neighborhoods = neighborhoodNames(districts, "منطقه ۱");

  provinceInput.provinces[0].name = "تغییریافته";
  cityInput.cities[0] = "تغییریافته";
  districtInput.districts["منطقه ۱"][0] = "تغییریافته";
  neighborhoods[0] = "تغییریافته";

  assert.deepEqual(provinces, [{ id: 8, name: "تهران" }]);
  assert.deepEqual(cities, ["تهران"]);
  assert.deepEqual(districts, { "منطقه ۱": ["تجریش"] });
  assert.deepEqual(neighborhoodNames(districts, "منطقه ۱"), ["تجریش"]);
});

test("the latest request exclusively owns commit and cleanup", () => {
  const owner = createLocationRequestOwner();
  let loading = false;
  let committed = "";

  const first = owner.start();
  loading = true;
  const second = owner.start();

  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.signal.aborted, false);
  assert.equal(second.isCurrent(), true);

  if (first.isCurrent()) committed = "old";
  if (first.isCurrent()) loading = false;
  assert.equal(committed, "");
  assert.equal(loading, true);

  if (second.isCurrent()) committed = "new";
  if (second.isCurrent()) loading = false;
  assert.equal(committed, "new");
  assert.equal(loading, false);

  owner.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
});

test("current non-ok and malformed responses produce only the supplied localized error", async () => {
  for (const nextResponse of [
    response(false, { cities: ["نباید پذیرفته شود"] }),
    response(true, { error: "malformed" }),
  ]) {
    const owner = createLocationRequestOwner();
    const state = { cities: ["قدیمی"], error: "", loading: false };
    const load = startLocationLoad({
      owner,
      errorMessage: "دریافت فهرست شهرها ناموفق بود",
      load: (signal) => readLocationResponse(Promise.resolve(nextResponse), parseCityResponse, signal),
      onStart: () => { state.error = ""; state.loading = true; },
      onSuccess: (cities) => { state.cities = cities; state.error = ""; },
      onError: (message) => { state.cities = []; state.error = message; },
      onComplete: () => { state.loading = false; },
    });

    await load.done;
    assert.deepEqual(state, {
      cities: [],
      error: "دریافت فهرست شهرها ناموفق بود",
      loading: false,
    });
  }
});

test("a composed response read can select its own localized consumer error", async () => {
  const owner = createLocationRequestOwner();
  let error = "";
  const load = startLocationLoad({
    owner,
    errorMessage: "دریافت فهرست شهرها ناموفق بود",
    load: (signal) => readLocationResponse(
      Promise.resolve(response(true, { error: "malformed" })),
      parseTehranDistrictResponse,
      signal,
      "دریافت فهرست مناطق تهران ناموفق بود",
    ),
    onStart: () => { error = ""; },
    onSuccess: () => {},
    onError: (message) => { error = message; },
    onComplete: () => {},
  });

  await load.done;
  assert.equal(error, "دریافت فهرست مناطق تهران ناموفق بود");
});

test("overlapping old success, error, and finally callbacks cannot change the current adapter", async () => {
  const owner = createLocationRequestOwner();
  const firstResponse = deferred<ReturnType<typeof response>>();
  const secondResponse = deferred<ReturnType<typeof response>>();
  const state = { cities: [] as string[], error: "", loading: false };
  const adapter = {
    onStart: () => { state.error = ""; state.loading = true; },
    onSuccess: (cities: string[]) => { state.cities = cities; state.error = ""; },
    onError: (message: string) => { state.cities = []; state.error = message; },
    onComplete: () => { state.loading = false; },
  };

  const first = startLocationLoad({
    owner,
    errorMessage: "خطای قدیمی",
    load: (signal) => readLocationResponse(firstResponse.promise, parseCityResponse, signal),
    ...adapter,
  });
  const second = startLocationLoad({
    owner,
    errorMessage: "خطای جاری",
    load: (signal) => readLocationResponse(secondResponse.promise, parseCityResponse, signal),
    ...adapter,
  });

  firstResponse.resolve(response(true, { cities: ["قدیمی"] }));
  await first.done;
  assert.deepEqual(state, { cities: [], error: "", loading: true });

  secondResponse.resolve(response(true, { cities: ["جدید"] }));
  await second.done;
  assert.deepEqual(state, { cities: ["جدید"], error: "", loading: false });

  const thirdResponse = deferred<ReturnType<typeof response>>();
  const fourthResponse = deferred<ReturnType<typeof response>>();
  const third = startLocationLoad({
    owner,
    errorMessage: "خطای قدیمی",
    load: (signal) => readLocationResponse(thirdResponse.promise, parseCityResponse, signal),
    ...adapter,
  });
  const fourth = startLocationLoad({
    owner,
    errorMessage: "خطای جاری",
    load: (signal) => readLocationResponse(fourthResponse.promise, parseCityResponse, signal),
    ...adapter,
  });
  thirdResponse.reject(new Error("old failure"));
  await third.done;
  assert.deepEqual(state, { cities: ["جدید"], error: "", loading: true });
  fourthResponse.resolve(response(true, { cities: [] }));
  await fourth.done;
  assert.deepEqual(state, { cities: [], error: "", loading: false });
});

test("cancellation makes pending success and completion callbacks inert", async () => {
  const owner = createLocationRequestOwner();
  const pending = deferred<ReturnType<typeof response>>();
  const events: string[] = [];
  const load = startLocationLoad({
    owner,
    errorMessage: "خطا",
    load: (signal) => readLocationResponse(pending.promise, parseCityResponse, signal),
    onStart: () => events.push("start"),
    onSuccess: () => events.push("success"),
    onError: () => events.push("error"),
    onComplete: () => events.push("complete"),
  });

  load.cancel();
  pending.resolve(response(true, { cities: ["تهران"] }));
  await load.done;
  assert.deepEqual(events, ["start"]);
});
