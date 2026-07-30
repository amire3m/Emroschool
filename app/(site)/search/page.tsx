"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, GraduationCap, Loader2, Newspaper, Search, Sparkles, UserRound } from "lucide-react";

interface SearchResult {
  id: string;
  type: "course" | "event" | "instructor" | "alumni" | "news";
  title: string;
  description: string;
  image: string | null;
  meta: string | null;
  url: string;
}

const types = {
  all: { label: "همه", icon: Sparkles },
  course: { label: "دوره‌ها", icon: BookOpen },
  event: { label: "رویدادها", icon: CalendarDays },
  instructor: { label: "اساتید", icon: UserRound },
  alumni: { label: "هنرآموختگان", icon: GraduationCap },
  news: { label: "اخبار", icon: Newspaper },
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filter, setFilter] = useState<keyof typeof types>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("q")?.trim() || "";
    setQuery(value);
    setInput(value);
    if (value.length < 2) { setLoading(false); return; }
    fetch(`/api/search?q=${encodeURIComponent(value)}`)
      .then((response) => response.json())
      .then((data) => setResults(data.results || []))
      .finally(() => setLoading(false));
  }, []);

  const visibleResults = filter === "all" ? results : results.filter((item) => item.type === filter);

  return <main className="min-h-screen pt-28 pb-20">
    <section className="max-w-[1180px] mx-auto px-5 md:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-primary text-white px-6 py-10 md:px-12 md:py-14 shadow-2xl">
        <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full border border-secondary-fixed/20 animate-[spin_18s_linear_infinite]"><span className="absolute top-8 right-8 w-3 h-3 rounded-full bg-secondary-fixed shadow-[0_0_25px_#ffdeab]" /></div>
        <div className="absolute -bottom-28 right-1/3 w-60 h-60 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-secondary-fixed text-sm font-bold mb-3">جستجو در تمام آکادمی</p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight">هر چیزی که دنبالش هستید، از همین‌جا پیدا کنید.</h1>
          <form action="/search" className="relative mt-8"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-primary" size={21} /><input name="q" value={input} onChange={(event) => setInput(event.target.value)} className="w-full rounded-2xl bg-white text-primary pr-14 pl-28 py-4 outline-none ring-4 ring-white/10 focus:ring-secondary-fixed/30 transition-shadow" placeholder="دوره، رویداد، استاد، هنرآموخته یا خبر..." /><button className="absolute left-2 top-2 bottom-2 bg-secondary text-white px-5 rounded-xl text-sm font-bold">جستجو</button></form>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar mt-8 pb-2">{Object.entries(types).map(([key, item]) => { const Icon = item.icon; const count = key === "all" ? results.length : results.filter((result) => result.type === key).length; return <button key={key} onClick={() => setFilter(key as keyof typeof types)} className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${filter === key ? "bg-primary text-white shadow-lg -translate-y-0.5" : "bg-white border border-surface-variant text-outline hover:text-primary"}`}><Icon size={16} />{item.label}<span className="text-[10px] opacity-60">{count.toLocaleString("fa-IR")}</span></button>; })}</div>

      {loading ? <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-secondary" size={34} /></div> : visibleResults.length === 0 ? <div className="py-24 text-center"><Search size={44} className="mx-auto text-outline-variant mb-4" /><h2 className="text-xl font-bold text-primary">نتیجه‌ای برای «{query}» پیدا نشد</h2><p className="text-outline mt-2">عبارت کوتاه‌تر یا متفاوتی امتحان کنید.</p></div> : <div className="grid md:grid-cols-2 gap-4 mt-6">{visibleResults.map((result, index) => { const TypeIcon = types[result.type].icon; return <Link key={`${result.type}-${result.id}`} href={result.url} style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }} className="group bg-white rounded-2xl border border-surface-variant p-3 flex gap-4 hover:border-secondary/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">
        <div className="w-24 h-24 rounded-xl bg-surface-low overflow-hidden shrink-0 flex items-center justify-center text-outline">{result.image ? <img src={result.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <TypeIcon size={28} />}</div>
        <div className="min-w-0 py-1"><span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary"><TypeIcon size={12} />{types[result.type].label}</span><h2 className="font-black text-primary mt-1 truncate group-hover:text-secondary transition-colors">{result.title}</h2><p className="text-xs text-outline line-clamp-2 mt-1 leading-6">{result.description}</p>{result.meta && <p className="text-[11px] text-outline-variant mt-1 truncate">{result.meta}</p>}</div>
      </Link>; })}</div>}
    </section>
  </main>;
}
