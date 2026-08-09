import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { absoluteUrl, magazineUrl, siteName } from "@/lib/seo";
import { InitialDataProvider } from "@/components/seo/initial-data-provider";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await prisma.newsPost.findFirst({ where: { slug: params.slug, published: true }, select: { title: true, excerpt: true, coverImage: true } });
  if (!post) return { robots: { index: false, follow: false } };
  return { title: post.title, description: post.excerpt, alternates: { canonical: `${magazineUrl}/news/${params.slug}` }, openGraph: { type: "article", title: post.title, description: post.excerpt, images: post.coverImage ? [{ url: post.coverImage }] : [] } };
}

export default async function NewsPostLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const post = await prisma.newsPost.findFirst({ where: { slug: params.slug, published: true } });
  if (!post) return children;
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt, mainEntityOfPage: absoluteUrl(`/news/${params.slug}`, magazineUrl), ...(post.coverImage ? { image: [post.coverImage] } : {}), datePublished: (post.publishedAt || post.updatedAt).toISOString(), dateModified: post.updatedAt.toISOString(), author: { "@type": "Person", name: post.authorName || "تحریریه آکادمی" }, publisher: { "@type": "Organization", name: siteName, url: absoluteUrl("/") } };
  return <InitialDataProvider data={{ post }}>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /></InitialDataProvider>;
}
