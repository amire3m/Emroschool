import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test, { after, before } from "node:test";
import { NextRequest } from "next/server";

const originalFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error("Iran location code must not call fetch");
}) as typeof fetch;

let locationsRoute: typeof import("../app/api/locations/route");
let tehranRoute: typeof import("../app/api/tehran-neighborhoods/route");
let routeHandlers: typeof import("../lib/iran-location-route-handlers");
let locations: typeof import("../lib/iran-locations");
let citiesSnapshot: Array<{ name: string; provinceId: number }>;
let provincesSnapshot: Array<{ id: number; name: string }>;
let districtsSnapshot: Record<string, string[]>;

before(async () => {
  const [loadedLocationsRoute, loadedTehranRoute, loadedRouteHandlers, cities, provinces, districts, loadedLocations] =
    await Promise.all([
      import("../app/api/locations/route"),
      import("../app/api/tehran-neighborhoods/route"),
      import("../lib/iran-location-route-handlers"),
      import("../data/iran/cities.json"),
      import("../data/iran/provinces.json"),
      import("../data/iran/tehran-neighborhoods.json"),
      import("../lib/iran-locations"),
    ]);
  locationsRoute = loadedLocationsRoute;
  tehranRoute = loadedTehranRoute;
  routeHandlers = loadedRouteHandlers;
  citiesSnapshot = cities.default as typeof citiesSnapshot;
  provincesSnapshot = provinces.default as typeof provincesSnapshot;
  districtsSnapshot = districts.default as typeof districtsSnapshot;
  locations = loadedLocations;
});

after(() => {
  globalThis.fetch = originalFetch;
});

const officialTehranDistricts = Object.fromEntries(
  [
    "منطقه ۱ شهر تهران",
    "منطقه ۲ شهر تهران",
    "منطقه ۳ شهر تهران",
    "منطقه ۴ شهر تهران",
    "منطقه ۵ شهر تهران",
    "منطقه ۶ شهر تهران",
    "منطقه ۷ شهر تهران",
    "منطقه ۸ شهر تهران",
    "منطقه ۹ شهر تهران",
    "منطقه ۱۰ شهر تهران",
    "منطقه ۱۱ شهر تهران",
    "منطقه ۱۲ شهر تهران",
    "منطقه ۱۳ شهر تهران",
    "منطقه ۱۴ شهر تهران",
    "منطقه ۱۵ شهر تهران",
    "منطقه ۱۶ شهر تهران",
    "منطقه ۱۷ شهر تهران",
    "منطقه ۱۸ شهر تهران",
    "منطقه ۱۹ شهر تهران",
    "منطقه ۲۰ شهر تهران",
    "منطقه ۲۱ شهر تهران",
    "منطقه ۲۲ شهر تهران",
  ].map((district) => [district, []]),
);

test("committed location snapshots match documented exact counts and SHA-256 hashes", async () => {
  const snapshots = [
    {
      file: "provinces.json",
      count: 31,
      hash: "93299179d54c41cef1848ad3ff6c4e94d05ad357840de6af227286880023cf99",
      countRecords: (value: unknown) => Array.isArray(value) ? value.length : -1,
    },
    {
      file: "cities.json",
      count: 1193,
      hash: "051b27257a59dd32e62fd007a0ce2a919faa05b275be36ed204f28f38560ca34",
      countRecords: (value: unknown) => Array.isArray(value) ? value.length : -1,
    },
    {
      file: "tehran-neighborhoods.json",
      count: 22,
      hash: "95bdd0e090928d48933a3f921a666f9b66fb2e7646f53f1777731fe481534e9a",
      countRecords: (value: unknown) => value && typeof value === "object"
        ? Object.keys(value).length
        : -1,
    },
  ];

  for (const snapshot of snapshots) {
    const bytes = await readFile(new URL(`../data/iran/${snapshot.file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), snapshot.hash);
    assert.equal(snapshot.countRecords(JSON.parse(bytes.toString("utf8"))), snapshot.count);
  }
});

test("server-only production guard rejects ordinary Node imports", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import 'server-only'"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be imported from a Client Component module/);
});

test("repository snapshots contain complete internally consistent location data", () => {
  const provinceIds = new Set<number>();
  const provinceNames = new Set<string>();
  assert.ok(provincesSnapshot.length > 0);
  assert.ok(citiesSnapshot.length > 0);

  for (const province of provincesSnapshot) {
    assert.equal(Number.isInteger(province.id), true);
    assert.ok(province.id > 0);
    assert.equal(province.name.trim(), province.name);
    assert.ok(province.name.length > 0);
    assert.equal(provinceIds.has(province.id), false);
    assert.equal(provinceNames.has(province.name), false);
    provinceIds.add(province.id);
    provinceNames.add(province.name);
  }

  const cityNamesByProvince = new Map<number, Set<string>>();
  for (const city of citiesSnapshot) {
    assert.equal(provinceIds.has(city.provinceId), true);
    assert.equal(city.name.trim(), city.name);
    assert.ok(city.name.length > 0);
    const names = cityNamesByProvince.get(city.provinceId) ?? new Set<string>();
    assert.equal(names.has(city.name), false);
    names.add(city.name);
    cityNamesByProvince.set(city.provinceId, names);
  }
  for (const provinceId of provinceIds) {
    assert.ok((cityNamesByProvince.get(provinceId)?.size ?? 0) > 0);
  }

  assert.equal(provincesSnapshot.find((province) => province.id === 123)?.name, "تهران");
  assert.equal(cityNamesByProvince.get(123)?.has("تهران"), true);
  assert.deepEqual(Object.keys(districtsSnapshot), Object.keys(officialTehranDistricts));
  for (const neighborhoods of Object.values(districtsSnapshot)) {
    assert.ok(neighborhoods.length > 0);
    assert.equal(new Set(neighborhoods).size, neighborhoods.length);
  }
});

test("snapshot validation rejects incomplete or malformed structures", () => {
  const { validateIranLocationData } = locations;
  const valid = {
    provinces: [{ id: 123, name: "تهران" }],
    cities: [{ name: "تهران", provinceId: 123 }],
    districts: { "منطقه ۱ شهر تهران": [] },
  };
  const invalidSnapshots: unknown[] = [
    null,
    { ...valid, extra: true },
    { ...valid, provinces: {} },
    { ...valid, provinces: [] },
    { ...valid, cities: [] },
    { ...valid, districts: {} },
    {
      ...valid,
      provinces: [
        { id: 123, name: "تهران" },
        { id: 124, name: "البرز" },
      ],
    },
    { ...valid, provinces: [{ id: 123, name: "تهران", extra: true }] },
    { ...valid, provinces: [{ id: 0, name: "تهران" }] },
    { ...valid, provinces: [{ id: 123.5, name: "تهران" }] },
    { ...valid, provinces: [{ id: 123, name: " تهران" }] },
    { ...valid, provinces: [{ id: 123, name: "تهران" }, { id: 123, name: "البرز" }] },
    { ...valid, provinces: [{ id: 123, name: "تهران" }, { id: 124, name: "تهران" }] },
    { ...valid, cities: [{ name: "تهران", provinceId: 999 }] },
    { ...valid, cities: [{ name: "تهران", provinceId: 123, extra: true }] },
    { ...valid, cities: [{ name: "", provinceId: 123 }] },
    { ...valid, cities: [{ name: "تهران", provinceId: -1 }] },
    {
      ...valid,
      cities: [
        { name: "تهران", provinceId: 123 },
        { name: "تهران", provinceId: 123 },
      ],
    },
    { ...valid, districts: [] },
    { ...valid, districts: { "": [] } },
    { ...valid, districts: { "منطقه ۱ شهر تهران": ["تجریش", "تجریش"] } },
    { ...valid, districts: { "منطقه ۱ شهر تهران": [" تجریش"] } },
  ];

  for (const snapshot of invalidSnapshots) {
    assert.throws(() => validateIranLocationData(snapshot));
  }
  assert.doesNotThrow(() => validateIranLocationData(valid));
  assert.doesNotThrow(() =>
    validateIranLocationData({
      ...valid,
      districts: { "منطقه ۱ شهر تهران": ["تجریش"] },
    }),
  );
});

test("province parsing accepts canonical signed safe ASCII integers", () => {
  const { InvalidProvinceIdError, parseProvinceId } = locations;
  assert.equal(parseProvinceId(null), null);
  assert.equal(parseProvinceId("123"), 123);
  assert.equal(parseProvinceId("0"), 0);
  assert.equal(parseProvinceId("-1"), -1);
  assert.equal(parseProvinceId(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  assert.equal(parseProvinceId(String(Number.MIN_SAFE_INTEGER)), Number.MIN_SAFE_INTEGER);

  for (const value of [
    "",
    "00",
    "01",
    "-0",
    "-01",
    "+1",
    "1.0",
    " 1",
    "1 ",
    "۱۲۳",
    "abc",
    "9007199254740992",
    "-9007199254740992",
    "1e309",
  ]) {
    assert.throws(() => parseProvinceId(value), InvalidProvinceIdError);
  }
});

test("public location functions return defensive copies", () => {
  const { getTehranDistricts, listCitiesByProvinceId, listProvinces } = locations;
  const provinces = listProvinces();
  const tehran = provinces.find((province) => province.id === 123);
  assert.ok(tehran);
  tehran.name = "changed";
  provinces.push({ id: 999999, name: "changed" });
  assert.equal(listProvinces().find((province) => province.id === 123)?.name, "تهران");
  assert.equal(listProvinces().some((province) => province.id === 999999), false);

  const cities = listCitiesByProvinceId(123);
  cities[0] = "changed";
  cities.push("changed");
  assert.equal(listCitiesByProvinceId(123).includes("changed"), false);
  assert.deepEqual(listCitiesByProvinceId(999999), []);

  const districts = getTehranDistricts();
  const districtCount = Object.keys(districts).length;
  districts["منطقه ۱ شهر تهران"].push("changed");
  districts.changed = ["changed"];
  const fresh = getTehranDistricts();
  assert.equal(Object.keys(fresh).length, districtCount);
  assert.equal(fresh["منطقه ۱ شهر تهران"].includes("changed"), false);
  assert.equal(fresh.changed, undefined);
});

test("location routes return complete local payloads without network access", async () => {
  const { getTehranDistricts, listCitiesByProvinceId, listProvinces } = locations;
  const provincesResponse = await locationsRoute.GET(
    new NextRequest("http://localhost/api/locations"),
  );
  assert.equal(provincesResponse.status, 200);
  assert.deepEqual(await provincesResponse.json(), { provinces: listProvinces() });

  const tehranCitiesResponse = await locationsRoute.GET(
    new NextRequest("http://localhost/api/locations?provinceId=123"),
  );
  assert.equal(tehranCitiesResponse.status, 200);
  assert.deepEqual(await tehranCitiesResponse.json(), {
    cities: listCitiesByProvinceId(123),
  });

  const districtsResponse = await tehranRoute.GET();
  assert.equal(districtsResponse.status, 200);
  assert.deepEqual(await districtsResponse.json(), { districts: getTehranDistricts() });
});

test("location query handling distinguishes absent, unknown, and malformed IDs", async () => {
  for (const provinceId of ["999999", "0", "-1"]) {
    const response = await locationsRoute.GET(
      new NextRequest(`http://localhost/api/locations?provinceId=${provinceId}`),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { cities: [] });
  }

  const malformedResponse = await locationsRoute.GET(
    new NextRequest("http://localhost/api/locations?provinceId=abc"),
  );
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), {
    error: "شناسه استان نامعتبر است",
  });
});

test("locations handler maps unexpected local failures to its fixed 500 response", async () => {
  const { listCitiesByProvinceId, parseProvinceId } = locations;
  const handler = routeHandlers.createLocationsHandler({
    parseProvinceId,
    listProvinces() {
      throw new Error("local data failure");
    },
    listCitiesByProvinceId,
  });

  const response = await handler(new NextRequest("http://localhost/api/locations"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "خطا در دریافت فهرست استان و شهر",
  });
});

test("Tehran handler maps unexpected local failures to its fixed 500 response", async () => {
  const handler = routeHandlers.createTehranNeighborhoodsHandler({
    getTehranDistricts() {
      throw new Error("local data failure");
    },
  });

  const response = await handler();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "خطا در دریافت فهرست مناطق تهران",
  });
});
