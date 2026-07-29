import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const fallbackIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#03004b"/>
  <path d="M32 10l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" fill="#ffdeab"/>
</svg>`;

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.siteSetting.findFirst({
      select: { siteLogo: true },
    });

    if (settings?.siteLogo && settings.siteLogo !== "/api/favicon") {
      const logoUrl = new URL(settings.siteLogo, req.nextUrl.origin);
      if (logoUrl.protocol === "http:" || logoUrl.protocol === "https:") {
        return NextResponse.redirect(logoUrl, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      }
    }
  } catch (error) {
    console.error("Favicon error:", error);
  }

  return new NextResponse(fallbackIcon.trim(), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
