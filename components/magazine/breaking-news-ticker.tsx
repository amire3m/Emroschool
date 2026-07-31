"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Radio, Sparkles } from "lucide-react";

interface BreakingItem { title: string; link: string; publishedAt: string; }

export default function BreakingNewsTicker() {
  const [items, setItems] = useState<BreakingItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/magazine/breaking-news", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active && Array.isArray(data.items)) setItems(data.items); })
      .catch(() => {});
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!items.length) return null;
  const tickerItems = [...items, ...items];

  return <section aria-label="اخبار فوری" className="border-t border-primary/10 bg-[#f5f3ee] px-5 py-8 md:px-8 md:py-10">
    <div className="mx-auto max-w-[1280px] overflow-hidden rounded-2xl border border-[#25205f]/15 bg-[#09063f] text-white shadow-[0_20px_45px_-28px_rgba(8,4,67,0.8)]">
      <div className="flex min-h-16 items-stretch">
        <div className="relative z-10 flex shrink-0 items-center gap-2 bg-secondary-fixed px-4 text-xs font-black text-primary md:px-6 md:text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10"><Radio size={15} className="animate-pulse" /></span>
          <span className="hidden sm:inline">اخبار فوری</span>
          <span className="sm:hidden">فوری</span>
          <Sparkles size={14} className="absolute -left-2 top-2 text-secondary-fixed" />
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden before:absolute before:inset-y-0 before:right-0 before:z-10 before:w-10 before:bg-gradient-to-l before:from-[#09063f] before:to-transparent after:absolute after:inset-y-0 after:left-0 after:z-10 after:w-10 after:bg-gradient-to-r after:from-[#09063f] after:to-transparent" dir="rtl">
          <div className="breaking-news-track flex h-full w-max items-center hover:[animation-play-state:paused]">
            {tickerItems.map((item, index) => <a key={`${item.link}-${index}`} href={item.link} target="_blank" rel="noopener noreferrer" className="group mx-5 inline-flex max-w-[min(70vw,38rem)] shrink-0 items-center gap-2 text-xs font-medium text-white/80 transition-colors hover:text-secondary-fixed md:mx-7 md:text-sm">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-fixed shadow-[0_0_10px_#ffdeab]" />
              <span className="truncate">{item.title}</span><ExternalLink size={12} className="shrink-0 text-secondary-fixed/70 transition-transform group-hover:-translate-x-0.5" />
            </a>)}
          </div>
        </div>
        <span className="hidden shrink-0 items-center border-r border-white/10 px-5 text-[10px] font-bold tracking-wide text-white/45 lg:flex">خبرگزاری مهر</span>
      </div>
    </div>
  </section>;
}
