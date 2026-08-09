import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, FolderOpen } from "lucide-react";
import prisma from "@/lib/prisma";
import CopyLinkButton from "@/components/ui/copy-link-button";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const image = await prisma.gallery.findFirst({ where: { slug: params.slug } });
  if (!image) return {};
  return {
    title: image.seoTitle || image.title || "گالری آکادمی",
    description: image.seoDescription || image.description || image.altText || undefined,
    alternates: { canonical: `/gallery/${params.slug}` },
    openGraph: { images: [image.imageUrl] },
  };
}

export default async function GalleryDetailPage({ params }: { params: { slug: string } }) {
  const image = await prisma.gallery.findFirst({ where: { slug: params.slug }, include: { course: { select: { title: true, slug: true } } } });
  if (!image) notFound();
  return <main className="min-h-screen pt-28 pb-20"><div className="max-w-5xl mx-auto px-5 md:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm text-outline hover:text-primary"><ArrowRight size={16} />بازگشت به صفحه اصلی</Link><div className="mt-6 overflow-hidden rounded-[2rem] bg-primary shadow-2xl"><img src={image.imageUrl} alt={image.altText || image.title || ""} className="w-full max-h-[72vh] object-contain" /></div><div className="max-w-3xl mx-auto bg-white rounded-[1.7rem] border border-surface-variant p-6 md:p-8 -mt-8 relative"><div className="flex flex-wrap gap-3 text-xs text-outline">{image.folder && <span className="flex items-center gap-1"><FolderOpen size={13} />{image.folder}</span>}{image.capturedAt && <span className="flex items-center gap-1"><CalendarDays size={13} />{new Date(image.capturedAt).toLocaleDateString("fa-IR")}</span>}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl md:text-3xl font-black text-primary">{image.title}</h1><CopyLinkButton path={`/gallery/${params.slug}`} /></div>{image.description && <p className="text-outline leading-8 mt-4 whitespace-pre-line">{image.description}</p>}{image.course && <Link href={`/courses/${image.course.slug}`} className="inline-block mt-5 text-secondary font-bold text-sm">مرتبط با دوره {image.course.title}</Link>}</div></div></main>;
}
