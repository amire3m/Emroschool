"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Loader2, Newspaper, Sparkles } from "lucide-react";

interface NewsPost {
  id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string | null;
  category: string; authorName: string | null; featured: boolean; publishedAt: string | null; createdAt: string;
}

const categoryLabels: Record<string, string> = { general: "خبر مدرسه", course: "دوره‌ها", instructor: "اساتید", alumni: "هنرآموختگان" };
const filters = [{ value: "all", label: "همه روایت‌ها" }, ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))];

function readingTime(content: string) { return Math.max(1, Math.ceil(content.split(/\s+/).length / 180)); }
function dateOf(post: NewsPost) { return new Date(post.publishedAt || post.createdAt).toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" }); }

export default function NewsPage() {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/news").then((response) => response.json()).then((data) => setNews(data.news || [])).finally(() => setLoading(false)); }, []);
  const featured = news.find((post) => post.featured) || news[0];
  const filtered = news.filter((post) => post.id !== featured?.id && (filter === "all" || post.category === filter));

  return <main className="min-h-screen overflow-hidden bg-[#f8f5ee] pt-20 pb-24">
    <section className="relative min-h-[72vh] bg-primary text-white flex items-end overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#7b5814_0,transparent_35%),radial-gradient(circle_at_80%_70%,#ffdeab33_0,transparent_30%)]" />
      <div className="absolute top-24 left-[8%] w-[28rem] h-[28rem] rounded-full border border-secondary-fixed/15 animate-[spin_28s_linear_infinite]"><div className="absolute top-10 right-12 w-4 h-4 rounded-full bg-secondary-fixed shadow-[0_0_35px_#ffdeab]" /><div className="absolute bottom-20 left-2 w-2 h-2 rounded-full bg-white/70" /></div>
      <div className="absolute top-1/2 right-[12%] -translate-y-1/2 text-[18vw] font-black text-white/[0.025] select-none whitespace-nowrap">روایت</div>
      <div className="relative max-w-[1280px] mx-auto px-5 md:px-8 pt-28 pb-14 w-full">
        <div className="flex items-center gap-2 text-secondary-fixed text-sm font-bold mb-6 animate-fade-in"><Sparkles size={17} />مجله مدرسه امام روح‌الله</div>
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 items-end">
          <div className="animate-fade-in-up"><h1 className="text-5xl md:text-7xl font-black leading-[1.15]">خبر فقط اتفاق نیست؛<br /><span className="text-secondary-fixed">روایتی‌ست که می‌ماند.</span></h1><p className="text-white/55 mt-6 max-w-xl leading-8">اینجا از مسیر دوره‌ها، تجربه اساتید و داستان هنرآموختگان می‌نویسیم؛ جایی برای دیدن پشت صحنه رشد.</p></div>
          {featured && <Link href={`/news/${featured.slug}`} className="group relative min-h-80 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up [animation-delay:180ms] opacity-0 [animation-fill-mode:forwards]">
            {featured.coverImage ? <img src={featured.coverImage} alt={featured.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.2s]" /> : <div className="absolute inset-0 bg-gradient-to-br from-secondary to-primary-container" />}
            <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/35 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 md:p-8"><span className="inline-flex px-3 py-1 rounded-full bg-secondary-fixed text-primary text-xs font-bold">روایت ویژه</span><h2 className="text-2xl md:text-3xl font-black mt-3 leading-relaxed">{featured.title}</h2><div className="flex items-center gap-4 mt-3 text-xs text-white/60"><span>{dateOf(featured)}</span><span>{readingTime(featured.content).toLocaleString("fa-IR")} دقیقه مطالعه</span></div></div>
            <span className="absolute top-5 left-5 w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center group-hover:bg-secondary-fixed group-hover:text-primary group-hover:-rotate-45 transition-all duration-500"><ArrowLeft size={20} /></span>
          </Link>}
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-5 md:px-8 pt-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8"><div><p className="text-secondary text-sm font-bold">تازه‌ترین نوشته‌ها</p><h2 className="text-3xl md:text-4xl font-black text-primary mt-2">از مدرسه چه خبر؟</h2></div><div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === item.value ? "bg-primary text-white" : "bg-white text-outline border border-black/5 hover:text-primary"}`}>{item.label}</button>)}</div></div>
      {loading ? <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-secondary" size={34} /></div> : news.length === 0 ? <div className="py-24 text-center text-outline"><Newspaper size={48} className="mx-auto mb-4 opacity-30" /><p>هنوز خبری منتشر نشده است.</p></div> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{filtered.map((post, index) => <Link key={post.id} href={`/news/${post.slug}`} style={{ animationDelay: `${index * 90}ms` }} className="group bg-white rounded-[1.6rem] overflow-hidden border border-black/5 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">
        <div className="aspect-[16/10] relative overflow-hidden bg-primary-container">{post.coverImage ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1s]" /> : <div className="w-full h-full flex items-center justify-center text-white/20"><Newspaper size={62} /></div>}<span className="absolute top-4 right-4 bg-primary/85 backdrop-blur text-secondary-fixed px-3 py-1 rounded-full text-[11px] font-bold">{categoryLabels[post.category]}</span></div>
        <div className="p-6"><div className="flex items-center gap-4 text-[11px] text-outline"><span className="flex items-center gap-1"><CalendarDays size={12} />{dateOf(post)}</span><span className="flex items-center gap-1"><Clock3 size={12} />{readingTime(post.content).toLocaleString("fa-IR")} دقیقه</span></div><h3 className="text-xl font-black text-primary mt-3 leading-8 group-hover:text-secondary transition-colors line-clamp-2">{post.title}</h3><p className="text-sm text-outline leading-7 mt-2 line-clamp-3">{post.excerpt}</p><div className="flex items-center gap-2 mt-5 text-xs font-bold text-secondary">ادامه روایت <ArrowLeft size={15} className="group-hover:-translate-x-2 transition-transform" /></div></div>
      </Link>)}</div>}
    </section>
  </main>;
}
