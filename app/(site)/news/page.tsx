"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Copy, ExternalLink, Loader2, Newspaper, PenLine, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import NewsSiteEditor from "@/components/news/news-site-editor";
import { getCookie } from "@/lib/cookie";

interface NewsPost {
  id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string | null;
  category: string; authorName: string | null; featured: boolean; publishedAt: string | null; createdAt: string;
}
interface MagazineSettings { heroLabel: string; heroTitle: string; heroHighlight: string; heroDescription: string; accentColor: string; }

const categoryLabels: Record<string, string> = { general: "خبر آکادمی", course: "دوره‌ها", instructor: "اساتید", alumni: "هنرآموختگان" };
const filters = [{ value: "all", label: "همه روایت‌ها" }, ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))];

function readingTime(content: string) { return Math.max(1, Math.ceil(content.split(/\s+/).length / 180)); }
function dateOf(post: NewsPost) { return new Date(post.publishedAt || post.createdAt).toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" }); }

export default function NewsPage() {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [canPublish, setCanPublish] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [publishedResult, setPublishedResult] = useState<{ title: string; url: string } | null>(null);
  const [magazineSettings, setMagazineSettings] = useState<MagazineSettings>({ heroLabel: "مجله آکادمی امام روح‌الله (ره)", heroTitle: "خبر فقط اتفاق نیست؛", heroHighlight: "روایتی‌ست که می‌ماند.", heroDescription: "اینجا از مسیر دوره‌ها، تجربه اساتید و داستان هنرآموختگان می‌نویسیم؛ جایی برای دیدن پشت صحنه رشد.", accentColor: "#ffdeab" });
  const heroRef = useRef<HTMLElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);

  function fetchNews() { setLoading(true); return fetch("/api/news").then((response) => response.json()).then((data) => setNews(data.news || [])).finally(() => setLoading(false)); }
  useEffect(() => { fetchNews(); fetch("/api/magazine-settings").then((response) => response.json()).then((data) => { if (!data.error) setMagazineSettings(data); }).catch(() => {}); const token = getCookie("token"); if (token) fetch("/api/auth/me", { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()).then(({ user }) => { if (!user || !["admin", "superadmin"].includes(user.role)) return; if (user.role === "superadmin" || !user.permissions) setCanPublish(true); else { try { const permissions = JSON.parse(user.permissions); setCanPublish(Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("news"))); } catch {} } }).catch(() => {}); }, []);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (event: MouseEvent) => { if (cursorGlowRef.current) cursorGlowRef.current.style.transform = `translate3d(${event.clientX - 160}px, ${event.clientY - 160}px, 0)`; };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  function moveHero(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    event.currentTarget.style.setProperty("--spot-x", `${x}px`); event.currentTarget.style.setProperty("--spot-y", `${y}px`);
    event.currentTarget.style.setProperty("--shift-x", `${(x / rect.width - 0.5) * 28}px`); event.currentTarget.style.setProperty("--shift-y", `${(y / rect.height - 0.5) * 18}px`);
    event.currentTarget.style.setProperty("--text-x", `${(0.5 - x / rect.width) * 13}px`); event.currentTarget.style.setProperty("--text-y", `${(0.5 - y / rect.height) * 7}px`);
  }

  function tiltCard(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    event.currentTarget.style.setProperty("--card-x", `${x}px`); event.currentTarget.style.setProperty("--card-y", `${y}px`);
    event.currentTarget.style.transform = `perspective(1000px) rotateX(${(0.5 - y / rect.height) * 7}deg) rotateY(${(x / rect.width - 0.5) * 8}deg) translateY(-6px)`;
  }

  function resetCard(event: PointerEvent<HTMLElement>) { event.currentTarget.style.transform = "perspective(1000px) rotateX(0) rotateY(0) translateY(0)"; }
  const featured = news.find((post) => post.featured) || news[0];
  const filtered = news.filter((post) => filter === "all" || post.category === filter);

  function handleCreated(result: { title: string; slug: string; published: boolean }) {
    fetchNews();
    if (result.published) setPublishedResult({ title: result.title, url: `${window.location.origin}/news/${result.slug}` });
  }

  return <main className="min-h-screen overflow-hidden bg-[#f8f5ee] pt-20 pb-24">
    <div ref={cursorGlowRef} className="hidden lg:block fixed z-20 top-0 left-0 w-80 h-80 rounded-full bg-secondary-fixed/[0.055] blur-3xl pointer-events-none will-change-transform" />
    <section ref={heroRef} onPointerMove={moveHero} className="relative min-h-[72vh] bg-primary text-white flex items-end overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#7b5814_0,transparent_35%),radial-gradient(circle_at_80%_70%,#ffdeab33_0,transparent_30%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-0 lg:opacity-100" style={{ background: "radial-gradient(480px circle at var(--spot-x, 20%) var(--spot-y, 30%), rgba(255,222,171,.13), transparent 70%)" }} />
      <div className="absolute top-24 left-[8%] w-[28rem] h-[28rem] rounded-full border border-secondary-fixed/15 animate-[spin_28s_linear_infinite] transition-transform duration-700 ease-out" style={{ transform: "translate3d(var(--shift-x, 0), var(--shift-y, 0), 0)" }}><div className="absolute top-10 right-12 w-4 h-4 rounded-full bg-secondary-fixed shadow-[0_0_35px_#ffdeab]" /><div className="absolute bottom-20 left-2 w-2 h-2 rounded-full bg-white/70" /></div>
      <div className="absolute top-1/2 right-[12%] text-[18vw] font-black text-white/[0.025] select-none whitespace-nowrap transition-transform duration-700 ease-out" style={{ transform: "translate3d(var(--text-x, 0), calc(-50% + var(--text-y, 0px)), 0)" }}>روایت</div>
      <div className="relative max-w-[1280px] mx-auto px-5 md:px-8 pt-28 pb-14 w-full">
        <div className="flex items-center gap-2 text-sm font-bold mb-6 animate-fade-in" style={{ color: magazineSettings.accentColor }}><Sparkles size={17} />{magazineSettings.heroLabel}</div>
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 items-end">
          <div className="animate-fade-in-up"><h1 className="text-5xl md:text-7xl font-black leading-[1.15]">{magazineSettings.heroTitle}<br /><span style={{ color: magazineSettings.accentColor }}>{magazineSettings.heroHighlight}</span></h1><p className="text-white/55 mt-6 max-w-xl leading-8">{magazineSettings.heroDescription}</p></div>
          {featured && <Link href={`/news/${featured.slug}`} onPointerMove={tiltCard} onPointerLeave={resetCard} className="group relative min-h-80 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up [animation-delay:180ms] opacity-0 [animation-fill-mode:forwards] transition-transform duration-300 ease-out will-change-transform">
            {featured.coverImage ? <img src={featured.coverImage} alt={featured.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.2s]" /> : <div className="absolute inset-0 bg-gradient-to-br from-secondary to-primary-container" />}
            <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/35 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 md:p-8"><span className="inline-flex px-3 py-1 rounded-full bg-secondary-fixed text-primary text-xs font-bold">روایت ویژه</span><h2 className="text-2xl md:text-3xl font-black mt-3 leading-relaxed">{featured.title}</h2><div className="flex items-center gap-4 mt-3 text-xs text-white/60"><span>{dateOf(featured)}</span><span>{readingTime(featured.content).toLocaleString("fa-IR")} دقیقه مطالعه</span></div></div>
            <span className="absolute top-5 left-5 w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center group-hover:bg-secondary-fixed group-hover:text-primary group-hover:-rotate-45 transition-all duration-500"><ArrowLeft size={20} /></span>
          </Link>}
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-5 md:px-8 pt-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8"><div><p className="text-secondary text-sm font-bold">تازه‌ترین نوشته‌ها</p><h2 className="text-3xl md:text-4xl font-black text-primary mt-2">از آکادمی چه خبر؟</h2></div><div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === item.value ? "bg-primary text-white" : "bg-white text-outline border border-black/5 hover:text-primary"}`}>{item.label}</button>)}</div></div>
      {loading ? <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-secondary" size={34} /></div> : news.length === 0 ? <div className="py-24 text-center text-outline"><Newspaper size={48} className="mx-auto mb-4 opacity-30" /><p>هنوز خبری منتشر نشده است.</p></div> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{filtered.map((post, index) => <Link key={post.id} href={`/news/${post.slug}`} onPointerMove={tiltCard} onPointerLeave={resetCard} style={{ animationDelay: `${index * 90}ms` }} className="group relative bg-white rounded-[1.6rem] overflow-hidden border border-black/5 hover:shadow-2xl transition-[transform,box-shadow,border-color] duration-300 ease-out animate-fade-in-up opacity-0 [animation-fill-mode:forwards] will-change-transform">
        <span className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "radial-gradient(240px circle at var(--card-x, 50%) var(--card-y, 50%), rgba(255,222,171,.22), transparent 70%)" }} />
        <div className="aspect-[16/10] relative overflow-hidden bg-primary-container">{post.coverImage ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1s]" /> : <div className="w-full h-full flex items-center justify-center text-white/20"><Newspaper size={62} /></div>}<span className="absolute top-4 right-4 bg-primary/85 backdrop-blur text-secondary-fixed px-3 py-1 rounded-full text-[11px] font-bold">{categoryLabels[post.category]}</span></div>
        <div className="p-6"><div className="flex items-center gap-4 text-[11px] text-outline"><span className="flex items-center gap-1"><CalendarDays size={12} />{dateOf(post)}</span><span className="flex items-center gap-1"><Clock3 size={12} />{readingTime(post.content).toLocaleString("fa-IR")} دقیقه</span></div><h3 className="text-xl font-black text-primary mt-3 leading-8 group-hover:text-secondary transition-colors line-clamp-2">{post.title}</h3><p className="text-sm text-outline leading-7 mt-2 line-clamp-3">{post.excerpt}</p><div className="flex items-center gap-2 mt-5 text-xs font-bold text-secondary">ادامه روایت <ArrowLeft size={15} className="group-hover:-translate-x-2 transition-transform" /></div></div>
      </Link>)}</div>}
    </section>
    {canPublish && <button onClick={() => setEditorOpen(true)} className="fixed z-40 bottom-6 left-6 md:bottom-8 md:left-8 group flex items-center gap-3 bg-secondary-fixed text-primary pl-5 pr-3 py-3 rounded-full shadow-[0_15px_45px_rgba(3,0,75,.28)] hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(123,88,20,.35)] transition-all"><span className="w-10 h-10 rounded-full bg-primary text-secondary-fixed flex items-center justify-center group-hover:rotate-12 transition-transform"><PenLine size={18} /></span><span className="font-black text-sm">انتشار روایت تازه</span></button>}
    {editorOpen && <NewsSiteEditor onClose={() => setEditorOpen(false)} onCreated={handleCreated} />}
    {publishedResult && <div className="fixed inset-0 z-[110] bg-primary/85 backdrop-blur-xl p-5 flex items-center justify-center animate-fade-in"><div className="relative w-full max-w-lg rounded-[2rem] bg-white p-7 md:p-10 text-center shadow-2xl animate-fade-in-up"><button onClick={() => setPublishedResult(null)} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-surface-low text-outline flex items-center justify-center hover:text-primary"><X size={17} /></button><div className="relative w-20 h-20 mx-auto"><span className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" /><span className="relative w-full h-full rounded-full bg-green-100 text-green-700 flex items-center justify-center"><CheckCircle2 size={38} /></span></div><p className="text-secondary text-sm font-bold mt-6">انتشار موفق</p><h2 className="text-2xl md:text-3xl font-black text-primary mt-2">روایت شما با موفقیت بارگذاری شد</h2><p className="text-sm text-outline leading-7 mt-3">«{publishedResult.title}» اکنون در مجله آکادمی قابل مشاهده است.</p><div className="flex items-center gap-2 bg-surface-low border border-surface-variant rounded-xl p-2 mt-6" dir="ltr"><input readOnly value={publishedResult.url} className="min-w-0 flex-1 bg-transparent px-2 text-xs text-outline outline-none" /><button onClick={async () => { await navigator.clipboard.writeText(publishedResult.url); toast.success("لینک روایت کپی شد"); }} className="w-9 h-9 rounded-lg bg-white text-primary flex items-center justify-center hover:bg-secondary-fixed transition-colors" title="کپی لینک"><Copy size={16} /></button></div><div className="flex flex-col sm:flex-row gap-3 mt-5"><a href={publishedResult.url} className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-5 py-3 text-sm font-bold"><ExternalLink size={16} />مشاهده روایت</a><button onClick={() => setPublishedResult(null)} className="flex-1 border border-surface-variant text-outline rounded-xl px-5 py-3 text-sm font-bold">بازگشت به مجله</button></div></div></div>}
  </main>;
}
