import { NextResponse } from "next/server";

const RSS_URL = "https://www.mehrnews.com/rss?pl=224";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

export async function GET() {
  try {
    const response = await fetch(RSS_URL, {
      headers: { "user-agent": "Imam Ruhollah Academy Magazine/1.0" },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`RSS request failed: ${response.status}`);

    const xml = await response.text();
    const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
      .map((match) => ({
        title: readTag(match[1], "title"),
        link: readTag(match[1], "link"),
        publishedAt: readTag(match[1], "pubDate"),
      }))
      .filter((item) => item.title && /^https:\/\/www\.mehrnews\.com\//.test(item.link))
      .slice(0, 12);

    return NextResponse.json({ items, source: "خبرگزاری مهر" }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ items: [], source: "خبرگزاری مهر" }, { status: 200 });
  }
}
