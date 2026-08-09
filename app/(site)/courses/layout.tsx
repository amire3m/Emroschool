import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { sortCoursesBySchedule } from "@/lib/course-order";
import { InitialDataProvider } from "@/components/seo/initial-data-provider";

export const metadata: Metadata = {
  title: "دوره‌های هنر و رسانه",
  description: "دوره‌های تخصصی هنر و رسانه آکادمی امام روح‌الله (ره) را مشاهده و مسیر یادگیری خود را انتخاب کنید.",
  alternates: { canonical: "/courses" },
};

export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  const [rawCourses, rawCategories] = await Promise.all([
    prisma.course.findMany({
      where: { published: true },
      include: {
        parent: { select: { id: true, title: true, slug: true } },
        prerequisite: { select: { id: true, title: true, slug: true } },
        instructorProfile: { select: { id: true, profileSlug: true, name: true, avatar: true, bio: true, expertise: true } },
        _count: { select: { gallery: true, children: true, enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { courses: true } } } }),
  ]);
  const courses = sortCoursesBySchedule(rawCourses).map((course) => ({
    ...course,
    galleryCount: course._count.gallery,
    childCount: course._count.children,
    enrollmentCount: course._count.enrollments,
    _count: undefined,
  }));
  const categories = rawCategories.map((category) => ({
    ...category,
    courseCount: category._count.courses,
    _count: undefined,
  }));

  return <InitialDataProvider data={{ courses, categories }}>{children}</InitialDataProvider>;
}
