import { NextResponse } from "next/server";

const sourceUrl = "https://gist.githubusercontent.com/frowzyispenguin/30a7d594ea01a668ccfc92c46d46bf0e/raw/53c97e3eed4e2ec6c7efcbdbd1ea744d064211d5/tehran.json";

export async function GET() {
  try {
    const response = await fetch(sourceUrl, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Unable to load Tehran neighborhoods");
    const districts = await response.json();
    return NextResponse.json({ districts });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت فهرست مناطق تهران" }, { status: 502 });
  }
}
