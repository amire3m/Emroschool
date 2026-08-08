import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { absoluteUrl, siteName } from "@/lib/seo";
import { InitialDataProvider } from "@/components/seo/initial-data-provider";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const course = await prisma.course.findFirst({
    where: { slug: params.slug, published: true },
    select: { title: true, description: true, thumbnail: true },
  });

  if (!course) return { robots: { index: false, follow: false } };

  return {
    title: course.title,
    description: course.description.slice(0, 160),
    alternates: { canonical: `/courses/${params.slug}` },
    openGraph: {
      type: "website",
      title: course.title,
      description: course.description.slice(0, 160),
      images: course.thumbnail ? [{ url: course.thumbnail }] : [],
    },
  };
}

export default async function CourseLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const course = await prisma.course.findFirst({
    where: { slug: params.slug, published: true },
    include: {
      gallery: true,
      parent: { select: { id: true, title: true, slug: true } },
      children: { where: { published: true }, orderBy: { startDate: "asc" }, select: { id: true, title: true, slug: true, thumbnail: true, description: true, instructor: true, price: true, registrationMode: true, scheduleStatus: true, startDate: true, endDate: true } },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) return children;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    url: absoluteUrl(`/courses/${params.slug}`),
    provider: { "@type": "Organization", name: siteName, url: absoluteUrl("/") },
    ...(course.thumbnail ? { image: course.thumbnail } : {}),
    ...(course.instructor ? { instructor: { "@type": "Person", name: course.instructor } } : {}),
    ...(course.startDate ? { hasCourseInstance: { "@type": "CourseInstance", startDate: course.startDate.toISOString() } } : {}),
  };

  return <InitialDataProvider data={{ course }}>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /></InitialDataProvider>;
}
