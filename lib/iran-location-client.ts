export interface IranProvince {
  id: number;
  name: string;
}

export interface LocationRequest {
  signal: AbortSignal;
  isCurrent: () => boolean;
}

export interface LocationRequestOwner {
  start: () => LocationRequest;
  cancel: () => void;
}

interface LocationResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

class LocalizedLocationError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isPlainArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function parseUniqueNames(value: unknown): string[] {
  if (!isPlainArray(value)) throw new TypeError("Invalid Iran location response");
  const names = value.map((name) => {
    if (!validName(name)) throw new TypeError("Invalid Iran location response");
    return name;
  });
  if (new Set(names).size !== names.length) {
    throw new TypeError("Invalid Iran location response");
  }
  return [...names];
}

export function parseProvinceResponse(input: unknown): IranProvince[] {
  if (!isPlainObject(input) || !hasExactKeys(input, ["provinces"]) || !isPlainArray(input.provinces)) {
    throw new TypeError("Invalid province response");
  }

  const ids = new Set<number>();
  const names = new Set<string>();
  return input.provinces.map((province) => {
    if (
      !isPlainObject(province) ||
      !hasExactKeys(province, ["id", "name"]) ||
      !Number.isSafeInteger(province.id) ||
      (province.id as number) <= 0 ||
      !validName(province.name) ||
      ids.has(province.id as number) ||
      names.has(province.name)
    ) {
      throw new TypeError("Invalid province response");
    }
    ids.add(province.id as number);
    names.add(province.name);
    return { id: province.id as number, name: province.name };
  });
}

export function parseCityResponse(input: unknown): string[] {
  if (!isPlainObject(input) || !hasExactKeys(input, ["cities"])) {
    throw new TypeError("Invalid city response");
  }
  return parseUniqueNames(input.cities);
}

export function parseTehranDistrictResponse(input: unknown): Record<string, string[]> {
  if (!isPlainObject(input) || !hasExactKeys(input, ["districts"]) || !isPlainObject(input.districts)) {
    throw new TypeError("Invalid Tehran district response");
  }

  const districts: Record<string, string[]> = {};
  for (const [district, neighborhoods] of Object.entries(input.districts)) {
    if (!validName(district) || ["__proto__", "constructor", "prototype"].includes(district)) {
      throw new TypeError("Invalid Tehran district response");
    }
    districts[district] = parseUniqueNames(neighborhoods);
  }
  return districts;
}

export function districtNames(districts: Record<string, string[]>): string[] {
  return [...Object.keys(districts)];
}

export function neighborhoodNames(
  districts: Record<string, string[]>,
  district: string,
): string[] {
  return districts[district] ? [...districts[district]] : [];
}

export function createLocationRequestOwner(): LocationRequestOwner {
  let active: AbortController | null = null;

  return {
    start(): LocationRequest {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => active === controller && !controller.signal.aborted,
      };
    },
    cancel(): void {
      active?.abort();
      active = null;
    },
  };
}

export async function readLocationResponse<T>(
  responsePromise: PromiseLike<LocationResponse>,
  parse: (input: unknown) => T,
  signal?: AbortSignal,
  errorMessage?: string,
): Promise<T> {
  try {
    const response = await responsePromise;
    if (!response.ok) throw new TypeError("Invalid Iran location response status");
    const input = await response.json();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return parse(input);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (errorMessage) throw new LocalizedLocationError(errorMessage);
    throw error;
  }
}

export function startLocationLoad<T>({
  owner,
  load,
  errorMessage,
  onStart,
  onSuccess,
  onError,
  onComplete,
}: {
  owner: LocationRequestOwner;
  load: (signal: AbortSignal) => Promise<T>;
  errorMessage: string;
  onStart: () => void;
  onSuccess: (value: T) => void;
  onError: (message: string) => void;
  onComplete: () => void;
}) {
  const request = owner.start();
  onStart();
  const done = (async () => {
    try {
      const value = await load(request.signal);
      if (request.isCurrent()) onSuccess(value);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (request.isCurrent()) {
        onError(error instanceof LocalizedLocationError ? error.message : errorMessage);
      }
    } finally {
      if (request.isCurrent()) onComplete();
    }
  })();

  return {
    signal: request.signal,
    isCurrent: request.isCurrent,
    done,
    cancel: () => {
      if (request.isCurrent()) owner.cancel();
    },
  };
}
