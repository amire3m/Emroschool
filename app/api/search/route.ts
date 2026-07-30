import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const MAGAZINE_SITE = process.env.NEXT_PUBLIC_MAGAZINE_URL || "https://mag.imamruhollahschool.com";

export async function GET(req: NextRequest) {
  const query = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  try {
    const [courses, events, instructors, alumni, news] = await Promise.all([
      prisma.course.findMany({
        where: { published: true, OR: [{ title: { contains: query } }, { description: { contains: query } }, { instructor: { contains: query } }] },
        select: { id: true, title: true, slug: true, description: true, thumbnail: true, instructor: true, categoryName: true },
        take: 12,
      }),
      prisma.event.findMany({
        where: { published: true, OR: [{ title: { contains: query } }, { description: { contains: query } }, { location: { contains: query } }] },
        select: { id: true, title: true, description: true, imageUrl: true, location: true, startDate: true },
        take: 12,
      }),
      prisma.instructor.findMany({
        where: { showOnSite: true, OR: [{ name: { contains: query } }, { bio: { contains: query } }, { expertise: { contains: query } }, { user: { is: { OR: [{ name: { contains: query } }, { bio: { contains: query } }, { expertise: { contains: query } }] } } }] },
        select: { id: true, name: true, bio: true, expertise: true, avatar: true, user: { select: { id: true, name: true, bio: true, expertise: true, avatar: true } } },
        take: 12,
      }),
      prisma.alumni.findMany({
        where: { showOnSite: true, OR: [{ name: { contains: query } }, { field: { contains: query } }, { quote: { contains: query } }, { achievements: { contains: query } }] },
        select: { id: true, name: true, field: true, quote: true, imageUrl: true, userId: true },
        take: 12,
      }),
      prisma.newsPost.findMany({
        where: { published: true, OR: [{ title: { contains: query } }, { excerpt: { contains: query } }, { content: { contains: query } }, { tags: { contains: query } }] },
        select: { id: true, title: true, slug: true, excerpt: true, coverImage: true, category: true, publishedAt: true },
        take: 12,
      }),
    ]);

    const results = [
      ...courses.map((item) => ({ id: item.id, type: "course", title: item.title, description: item.description, image: item.thumbnail, meta: item.instructor || item.categoryName, url: `/courses/${item.slug}` })),
      ...events.map((item) => ({ id: item.id, type: "event", title: item.title, description: item.description, image: item.imageUrl, meta: item.location, date: item.startDate, url: `/events/${item.id}` })),
      ...instructors.map((item) => ({ id: item.id, type: "instructor", title: item.user?.name || item.name || "استاد", description: item.user?.bio || item.bio || "", image: item.user?.avatar || item.avatar, meta: item.user?.expertise || item.expertise, url: item.user?.id ? `/profile/${item.user.id}` : "/instructors" })),
      ...alumni.map((item) => ({ id: item.id, type: "alumni", title: item.name, description: item.quote, image: item.imageUrl, meta: item.field, url: item.userId ? `/profile/${item.userId}` : "/honar-amooztegan" })),
      ...news.map((item) => ({ id: item.id, type: "news", title: item.title, description: item.excerpt, image: item.coverImage, meta: item.category, date: item.publishedAt, url: `${MAGAZINE_SITE}/news/${item.slug}` })),
    ];
    return NextResponse.json({ query, results, counts: { courses: courses.length, events: events.length, instructors: instructors.length, alumni: alumni.length, news: news.length } });
  } catch (error) {
    console.error("Global search error:", error);
    return NextResponse.json({ error: "خطا در جستجو" }, { status: 500 });
  }
}
