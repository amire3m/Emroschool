"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Radio } from "lucide-react";

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

  return <section aria-label="اخبار فوری" className="mt-20 border-b border-primary/10 bg-[#080443] text-white shadow-lg">
    <div className="mx-auto flex h-12 max-w-[1280px] items-stretch px-5 md:px-8">
      <div className="relative z-10 flex shrink-0 items-center gap-2 bg-secondary-fixed px-4 text-xs font-black text-primary after:absolute after:right-full after:top-0 after:h-full after:w-5 after:bg-secondary-fixed after:[clip-path:polygon(0_0,100%_50%,0_100%)] md:px-6">
        <Radio size={15} className="animate-pulse" />
        <span>اخبار فوری</span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden" dir="rtl">
        <div className="breaking-news-track flex h-full w-max items-center hover:[animation-play-state:paused]">
          {tickerItems.map((item, index) => <a key={`${item.link}-${index}`} href={item.link} target="_blank" rel="noopener noreferrer" className="mx-5 inline-flex max-w-[min(82vw,34rem)] shrink-0 items-center gap-2 text-xs font-medium text-white/80 transition-colors hover:text-secondary-fixed md:text-sm">
            <span className="truncate">{item.title}</span><ExternalLink size={12} className="shrink-0 text-secondary-fixed/70" />
          </a>)}
        </div>
      </div>
      <span className="hidden shrink-0 items-center px-3 text-[10px] text-white/40 lg:flex">مهر</span>
    </div>
  </section>;
}
