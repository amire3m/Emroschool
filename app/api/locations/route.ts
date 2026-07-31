import { NextRequest, NextResponse } from "next/server";

const PROVINCES_URL = "https://raw.githubusercontent.com/sajaddp/list-of-cities-in-Iran/main/dist/json/provinces.json";
const CITIES_URL = "https://raw.githubusercontent.com/sajaddp/list-of-cities-in-Iran/main/dist/json/cities-filtered.json";

interface Province { id: number; name: string; }
interface City { name: string; province_id: number; }

export async function GET(request: NextRequest) {
  try {
    const provinceId = request.nextUrl.searchParams.get("provinceId");
    if (!provinceId) {
      const response = await fetch(PROVINCES_URL, { next: { revalidate: 86400 } });
      if (!response.ok) throw new Error("Unable to load provinces");
      const provinces: Province[] = await response.json();
      return NextResponse.json({ provinces: provinces.map(({ id, name }) => ({ id, name })) });
    }

    const response = await fetch(CITIES_URL, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Unable to load cities");
    const cities: City[] = await response.json();
    const names = [...new Set(cities.filter((city) => city.province_id === Number(provinceId)).map((city) => city.name))].sort((first, second) => first.localeCompare(second, "fa"));
    return NextResponse.json({ cities: names });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت فهرست استان و شهر" }, { status: 502 });
  }
}
