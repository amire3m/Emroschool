import { NextRequest, NextResponse } from "next/server";

import {
  InvalidProvinceIdError,
  getTehranDistricts,
  listCitiesByProvinceId,
  listProvinces,
  parseProvinceId,
} from "@/lib/iran-locations";

interface LocationsDependencies {
  parseProvinceId: typeof parseProvinceId;
  listProvinces: typeof listProvinces;
  listCitiesByProvinceId: typeof listCitiesByProvinceId;
}

interface TehranNeighborhoodsDependencies {
  getTehranDistricts: typeof getTehranDistricts;
}

export function createLocationsHandler(dependencies: LocationsDependencies) {
  return async function locationsHandler(request: NextRequest) {
    try {
      const provinceId = dependencies.parseProvinceId(
        request.nextUrl.searchParams.get("provinceId"),
      );
      return provinceId === null
        ? NextResponse.json({ provinces: dependencies.listProvinces() })
        : NextResponse.json({ cities: dependencies.listCitiesByProvinceId(provinceId) });
    } catch (error) {
      if (error instanceof InvalidProvinceIdError) {
        return NextResponse.json({ error: "شناسه استان نامعتبر است" }, { status: 400 });
      }
      return NextResponse.json(
        { error: "خطا در دریافت فهرست استان و شهر" },
        { status: 500 },
      );
    }
  };
}

export function createTehranNeighborhoodsHandler(
  dependencies: TehranNeighborhoodsDependencies,
) {
  return async function tehranNeighborhoodsHandler() {
    try {
      return NextResponse.json({ districts: dependencies.getTehranDistricts() });
    } catch {
      return NextResponse.json(
        { error: "خطا در دریافت فهرست مناطق تهران" },
        { status: 500 },
      );
    }
  };
}
