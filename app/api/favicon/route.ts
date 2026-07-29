import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const fallbackIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#03004b"/>
  <path d="M32 10l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" fill="#ffdeab"/>
</svg>`;

function contentType(source: string) {
  const extension = path.extname(new URL(source, "http://localhost").pathname).toLowerCase();
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".ico") return "image/x-icon";
  return "image/png";
}

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.siteSetting.findFirst({
      select: { siteLogo: true },
    });

    if (settings?.siteLogo && !["/api/favicon", "/favicon.ico"].includes(settings.siteLogo)) {
      if (settings.siteLogo.startsWith("/")) {
        const publicDir = path.resolve(process.cwd(), "public");
        const logoPath = path.resolve(publicDir, `.${decodeURIComponent(settings.siteLogo)}`);
        if (logoPath.startsWith(`${publicDir}${path.sep}`)) {
          const file = await readFile(logoPath);
          return new NextResponse(new Uint8Array(file), {
            headers: {
              "Content-Type": contentType(settings.siteLogo),
              "Cache-Control": "no-store, max-age=0",
            },
          });
        }
      } else {
        const logoUrl = new URL(settings.siteLogo, req.nextUrl.origin);
        if (logoUrl.protocol === "http:" || logoUrl.protocol === "https:") {
          const response = await fetch(logoUrl, { cache: "no-store" });
          if (response.ok) {
            return new NextResponse(new Uint8Array(await response.arrayBuffer()), {
              headers: {
                "Content-Type": response.headers.get("content-type") || contentType(settings.siteLogo),
                "Cache-Control": "no-store, max-age=0",
              },
            });
          }
        }
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
