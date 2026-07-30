import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

const siteUrl = "https://imamruhollahschool.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, events, gallery, news] = await Promise.all([
    prisma.course.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.event.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.gallery.findMany({ where: { slug: { not: null } }, select: { slug: true, createdAt: true } }),
    prisma.newsPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);

  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/courses`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/events`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    ...courses.map((course) => ({ url: `${siteUrl}/courses/${course.slug}`, lastModified: course.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...events.map((event) => ({ url: `${siteUrl}/events/${event.slug}`, lastModified: event.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...gallery.filter((image) => image.slug).map((image) => ({ url: `${siteUrl}/gallery/${image.slug}`, lastModified: image.createdAt, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...news.map((post) => ({ url: `${siteUrl}/news/${post.slug}`, lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
