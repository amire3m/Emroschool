import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function todayKey(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const ua = req.headers.get("user-agent") || "";
    const visitorHash = crypto.createHash("sha256").update(`${ip}:${ua}`).digest("hex").slice(0, 16);
    const date = todayKey();

    const existing = await prisma.siteVisit.findUnique({ where: { date } });

    // Check if this visitor was already counted today (using a simple in-memory set)
    const visitorKey = `${date.toISOString().slice(0, 10)}:${visitorHash}`;
    const isNewVisitor = !globalThis.__seenVisitors?.has(visitorKey);

    if (!globalThis.__seenVisitors) globalThis.__seenVisitors = new Set();
    globalThis.__seenVisitors.add(visitorKey);

    if (existing) {
      await prisma.siteVisit.update({
        where: { date },
        data: {
          views: { increment: 1 },
          ...(isNewVisitor ? { visitors: { increment: 1 } } : {}),
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.siteVisit.create({
        data: { date, views: 1, visitors: isNewVisitor ? 1 : 0 },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __seenVisitors: Set<string> | undefined;
}
