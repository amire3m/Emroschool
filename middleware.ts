import { NextRequest, NextResponse } from "next/server";

const MAIN_SITE = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://imamruhollahschool.com";
const MAGAZINE_SITE = process.env.NEXT_PUBLIC_MAGAZINE_URL || "https://mag.imamruhollahschool.com";
const MAIN_HOST = new URL(MAIN_SITE).host;

export function middleware(req: NextRequest) {
  const hostname = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const pathname = req.nextUrl.pathname;

  if (hostname === `www.${MAIN_HOST}`) {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = MAIN_HOST;
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const isMagazine = hostname === "mag.imamruhollahschool.com" || hostname.startsWith("mag.");

  if (isMagazine) {
    const mainOnly = ["/login", "/register", "/dashboard", "/admin", "/courses", "/events", "/instructors", "/honar-amooztegan", "/profile"];
    if (mainOnly.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.redirect(new URL(`${MAIN_SITE}${pathname}${req.nextUrl.search}`));
    }
    if (pathname === "/") return NextResponse.rewrite(new URL("/news", req.url));
  } else {
    if (pathname === "/admin/news" || pathname.startsWith("/admin/news/")) return NextResponse.redirect(new URL("/mag-admin/posts", MAGAZINE_SITE));
    if (pathname === "/mag-admin" || pathname.startsWith("/mag-admin/")) return NextResponse.redirect(new URL(pathname, MAGAZINE_SITE));
  }

  const response = NextResponse.next();
  const canonicalBase = isMagazine ? MAGAZINE_SITE : MAIN_SITE;
  response.headers.set("Link", `<${canonicalBase}${pathname}>; rel="canonical"`);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
