import { NextResponse } from "next/server";

const sourceUrl = "https://github.com/farhadmpr/List-of-universities/raw/refs/heads/master/university.csv";

export async function GET() {
  try {
    const response = await fetch(sourceUrl, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Unable to load universities");
    const csv = await response.text();
    const universities = [...new Set(csv.split(/\r?\n/).slice(1).map((line) => line.match(/'([^']*)'/)?.[1]?.trim()).filter((name): name is string => Boolean(name)))];
    return NextResponse.json({ universities });
  } catch {
    return NextResponse.json({ error: "خطا در دریافت فهرست دانشگاه‌ها" }, { status: 502 });
  }
}
