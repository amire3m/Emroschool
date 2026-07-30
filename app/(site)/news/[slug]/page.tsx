"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Loader2, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import CopyLinkButton from "@/components/ui/copy-link-button";

interface NewsPost { id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string | null; category: string; authorName: string | null; publishedAt: string | null; createdAt: string; }
const categoryLabels: Record<string, string> = { general: "خبر آکادمی", course: "دوره‌ها", instructor: "اساتید", alumni: "هنرآموختگان" };

export default function NewsDetailPage({ params }: { params: { slug: string } }) {
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => { fetch(`/api/news/${params.slug}`).then(async (response) => response.ok ? response.json() : Promise.reject()).then((data) => setPost(data.newsPost)).finally(() => setLoading(false)); }, [params.slug]);
  useEffect(() => { const update = () => { const height = document.documentElement.scrollHeight - window.innerHeight; setProgress(height > 0 ? Math.min(100, (window.scrollY / height) * 100) : 0); headerRef.current?.style.setProperty("--scroll-y", `${window.scrollY * 0.18}px`); }; window.addEventListener("scroll", update, { passive: true }); return () => window.removeEventListener("scroll", update); }, []);

  function moveHeader(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    event.currentTarget.style.setProperty("--detail-spot-x", `${x}px`); event.currentTarget.style.setProperty("--detail-spot-y", `${y}px`);
    event.currentTarget.style.setProperty("--detail-x", `${(x / rect.width - 0.5) * 14}px`); event.currentTarget.style.setProperty("--detail-y", `${(y / rect.height - 0.5) * 8}px`);
  }

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center"><Loader2 className="animate-spin text-secondary" size={36} /></div>;
  if (!post) return <div className="min-h-screen pt-36 text-center"><h1 className="text-2xl font-black text-primary">این خبر پیدا نشد</h1><Link href="/news" className="inline-block mt-5 text-secondary font-bold">بازگشت به اخبار</Link></div>;
  const words = post.content.split(/\s+/).length;
  const date = new Date(post.publishedAt || post.createdAt).toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" });

  return <main className="min-h-screen bg-[#f8f5ee] pb-24">
    <div className="fixed top-0 right-0 z-[60] h-1 bg-secondary-fixed transition-[width] duration-100" style={{ width: `${progress}%` }} />
    <header ref={headerRef} onPointerMove={moveHeader} className="relative min-h-[78vh] bg-primary text-white overflow-hidden flex items-end pt-28">
      {post.coverImage && <img src={post.coverImage} alt={post.title} className="absolute -inset-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)] object-cover opacity-55 will-change-transform transition-transform duration-500 ease-out" style={{ transform: "translate3d(var(--detail-x, 0), calc(var(--scroll-y, 0px) + var(--detail-y, 0px)), 0) scale(1.08)" }} />}
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-primary/20" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,transparent_0,rgba(3,0,75,.7)_65%)]" />
      <div className="absolute inset-0 hidden lg:block pointer-events-none" style={{ background: "radial-gradient(520px circle at var(--detail-spot-x, 70%) var(--detail-spot-y, 25%), rgba(255,222,171,.14), transparent 68%)" }} />
      <div className="relative max-w-5xl mx-auto w-full px-5 md:px-8 pb-16"><Link href="/news" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-secondary-fixed transition-colors mb-10"><ArrowRight size={17} />بازگشت به مجله</Link><span className="block w-fit bg-secondary-fixed text-primary rounded-full px-4 py-1.5 text-xs font-bold">{categoryLabels[post.category]}</span><div className="mt-5 flex flex-wrap items-start justify-between gap-4"><h1 className="text-4xl md:text-6xl font-black leading-[1.35] max-w-4xl animate-fade-in-up">{post.title}</h1><CopyLinkButton path={`/news/${post.slug}`} /></div><p className="text-lg text-white/65 leading-8 max-w-3xl mt-5">{post.excerpt}</p><div className="flex flex-wrap items-center gap-5 mt-7 text-sm text-white/55"><span>{post.authorName || "تحریریه آکادمی"}</span><span className="flex items-center gap-1.5"><CalendarDays size={15} />{date}</span><span className="flex items-center gap-1.5"><Clock3 size={15} />{Math.max(1, Math.ceil(words / 180)).toLocaleString("fa-IR")} دقیقه مطالعه</span></div></div>
    </header>
    <article className="relative max-w-3xl mx-auto px-5 md:px-8 pt-14"><div className="absolute hidden lg:block -right-24 top-16 [writing-mode:vertical-rl] text-xs tracking-[.4em] text-secondary/40">IMAM RUHOLLAH ACADEMY · MAGAZINE</div><div className="space-y-7">{post.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index} className={index === 0 ? "text-xl md:text-2xl leading-[2.1] text-primary font-medium" : "text-base md:text-lg leading-[2.2] text-on-background/80 whitespace-pre-line"}>{paragraph}</p>)}</div><div className="border-t border-secondary/15 mt-14 pt-7 flex items-center justify-between"><div><p className="font-black text-primary">این روایت را به اشتراک بگذارید</p><p className="text-xs text-outline mt-1">شاید برای کسی الهام‌بخش باشد.</p></div><button onClick={async () => { await navigator.clipboard.writeText(window.location.href); toast.success("لینک خبر کپی شد"); }} className="w-12 h-12 rounded-full bg-primary text-secondary-fixed flex items-center justify-center hover:rotate-12 hover:scale-110 transition-all"><Share2 size={19} /></button></div></article>
  </main>;
}
