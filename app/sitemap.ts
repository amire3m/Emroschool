import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { magazineUrl, siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  const isMagazine = hostname === "mag.imamruhollahschool.com" || hostname.startsWith("mag.");
  const [courses, events, gallery, news] = await Promise.all([
    prisma.course.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.event.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.gallery.findMany({ where: { slug: { not: null }, title: { not: null } }, select: { slug: true, createdAt: true } }),
    prisma.newsPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);

  if (isMagazine) return [
    { url: `${magazineUrl}/`, changeFrequency: "daily", priority: 1 },
    ...news.map((post) => ({ url: `${magazineUrl}/news/${post.slug}`, lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/courses`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/events`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    ...courses.map((course) => ({ url: `${siteUrl}/courses/${course.slug}`, lastModified: course.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...events.map((event) => ({ url: `${siteUrl}/events/${event.slug}`, lastModified: event.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...gallery.filter((image) => image.slug).map((image) => ({ url: `${siteUrl}/gallery/${image.slug}`, lastModified: image.createdAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
