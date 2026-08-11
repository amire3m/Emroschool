import "server-only";

import citiesJson from "@/data/iran/cities.json";
import provincesJson from "@/data/iran/provinces.json";
import tehranDistrictsJson from "@/data/iran/tehran-neighborhoods.json";

export interface ProvinceRecord {
  id: number;
  name: string;
}

export interface CityRecord {
  name: string;
  provinceId: number;
}

export type TehranDistricts = Record<string, string[]>;

interface IranLocationData {
  provinces: ProvinceRecord[];
  cities: CityRecord[];
  districts: TehranDistricts;
}

export class InvalidProvinceIdError extends Error {
  constructor() {
    super("Invalid province ID");
    this.name = "InvalidProvinceIdError";
  }
}

export class IranLocationDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IranLocationDataValidationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key));
}

function isTrimmedNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isValidId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

export function validateIranLocationData(value: unknown): asserts value is IranLocationData {
  if (!isPlainObject(value) || !hasExactKeys(value, ["provinces", "cities", "districts"])) {
    throw new IranLocationDataValidationError("Location data must contain only provinces, cities, and districts");
  }

  const { provinces, cities, districts } = value;
  if (
    !Array.isArray(provinces) ||
    provinces.length === 0 ||
    !Array.isArray(cities) ||
    cities.length === 0 ||
    !isPlainObject(districts) ||
    Object.keys(districts).length === 0
  ) {
    throw new IranLocationDataValidationError("Location data collections have invalid structures");
  }

  const provinceIds = new Set<number>();
  const provinceNames = new Set<string>();
  for (const province of provinces) {
    if (
      !isPlainObject(province) ||
      !hasExactKeys(province, ["id", "name"]) ||
      !isValidId(province.id) ||
      !isTrimmedNonEmptyString(province.name)
    ) {
      throw new IranLocationDataValidationError("Invalid province record");
    }
    if (provinceIds.has(province.id) || provinceNames.has(province.name)) {
      throw new IranLocationDataValidationError("Duplicate province ID or name");
    }
    provinceIds.add(province.id);
    provinceNames.add(province.name);
  }

  const cityKeys = new Set<string>();
  const provinceIdsWithCities = new Set<number>();
  for (const city of cities) {
    if (
      !isPlainObject(city) ||
      !hasExactKeys(city, ["name", "provinceId"]) ||
      !isTrimmedNonEmptyString(city.name) ||
      !isValidId(city.provinceId)
    ) {
      throw new IranLocationDataValidationError("Invalid city record");
    }
    if (!provinceIds.has(city.provinceId)) {
      throw new IranLocationDataValidationError("City references an unknown province");
    }
    const cityKey = `${city.provinceId}\u0000${city.name}`;
    if (cityKeys.has(cityKey)) {
      throw new IranLocationDataValidationError("Duplicate city name within a province");
    }
    cityKeys.add(cityKey);
    provinceIdsWithCities.add(city.provinceId);
  }
  for (const provinceId of provinceIds) {
    if (!provinceIdsWithCities.has(provinceId)) {
      throw new IranLocationDataValidationError("Province has no cities");
    }
  }

  for (const [district, neighborhoods] of Object.entries(districts)) {
    if (!isTrimmedNonEmptyString(district) || !Array.isArray(neighborhoods)) {
      throw new IranLocationDataValidationError("Invalid Tehran district");
    }
    const names = new Set<string>();
    for (const neighborhood of neighborhoods) {
      if (!isTrimmedNonEmptyString(neighborhood) || names.has(neighborhood)) {
        throw new IranLocationDataValidationError("Invalid or duplicate Tehran neighborhood");
      }
      names.add(neighborhood);
    }
  }
}

const snapshot: unknown = {
  provinces: provincesJson,
  cities: citiesJson,
  districts: tehranDistrictsJson,
};

validateIranLocationData(snapshot);

const provinces = snapshot.provinces.map((province) => ({ ...province }));
const citiesByProvinceId = new Map<number, string[]>();
for (const city of snapshot.cities) {
  const names = citiesByProvinceId.get(city.provinceId) ?? [];
  names.push(city.name);
  citiesByProvinceId.set(city.provinceId, names);
}
for (const names of citiesByProvinceId.values()) {
  names.sort((first, second) => first.localeCompare(second, "fa"));
}
const tehranDistricts = Object.fromEntries(
  Object.entries(snapshot.districts).map(([district, neighborhoods]) => [
    district,
    [...neighborhoods],
  ]),
);

export function listProvinces(): ProvinceRecord[] {
  return provinces.map((province) => ({ ...province }));
}

export function listCitiesByProvinceId(provinceId: number): string[] {
  return [...(citiesByProvinceId.get(provinceId) ?? [])];
}

export function getTehranDistricts(): TehranDistricts {
  return Object.fromEntries(
    Object.entries(tehranDistricts).map(([district, neighborhoods]) => [
      district,
      [...neighborhoods],
    ]),
  );
}

export function parseProvinceId(value: string | null): number | null {
  if (value === null) return null;
  if (!/^(?:0|-?[1-9][0-9]*)$/.test(value)) throw new InvalidProvinceIdError();

  const provinceId = Number(value);
  if (!Number.isSafeInteger(provinceId)) {
    throw new InvalidProvinceIdError();
  }
  return provinceId;
}
