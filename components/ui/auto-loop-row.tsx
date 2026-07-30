"use client";

import { Children, useRef, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AutoLoopRow({
  children,
  slideClassName,
  speed = 0.8,
  showControls = true,
  controlsAlwaysVisible = false,
}: {
  children: ReactNode;
  slideClassName: string;
  speed?: number;
  showControls?: boolean;
  controlsAlwaysVisible?: boolean;
}) {
  const items = Children.toArray(children);
  const repeatCount = items.length < 5 ? 3 : 2;
  const repeated = Array.from({ length: repeatCount }, (_, repeat) =>
    items.map((item, index) => ({ item, key: `${repeat}-${index}` })),
  ).flat();
  const autoScroll = useRef(AutoScroll({ speed, startDelay: 300, stopOnInteraction: false, stopOnMouseEnter: true }));
  const [viewportRef, api] = useEmblaCarousel(
    { loop: true, direction: "rtl", align: "start", dragFree: true },
    [autoScroll.current],
  );

  if (items.length === 0) return null;
  const navigate = (direction: "prev" | "next") => {
    autoScroll.current.stop();
    direction === "prev" ? api?.scrollPrev() : api?.scrollNext();
    window.setTimeout(() => autoScroll.current.play(), 900);
  };

  return (
    <div className="group/loop relative" dir="rtl">
      <div ref={viewportRef} className="overflow-hidden cursor-grab active:cursor-grabbing py-3">
        <div className="flex touch-pan-y gap-4 md:gap-6">
          {repeated.map(({ item, key }) => <div key={key} className={`min-w-0 shrink-0 ${slideClassName}`}>{item}</div>)}
        </div>
      </div>
      {showControls && <><button type="button" onClick={() => navigate("prev")} className={`absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-secondary/20 bg-white/90 text-primary shadow-lg backdrop-blur transition-all hover:scale-110 hover:bg-secondary-fixed md:flex ${controlsAlwaysVisible ? "opacity-100" : "opacity-0 group-hover/loop:opacity-100 focus:opacity-100"}`} aria-label="مورد قبلی"><ChevronRight size={20} /></button>
      <button type="button" onClick={() => navigate("next")} className={`absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-secondary/20 bg-white/90 text-primary shadow-lg backdrop-blur transition-all hover:scale-110 hover:bg-secondary-fixed md:flex ${controlsAlwaysVisible ? "opacity-100" : "opacity-0 group-hover/loop:opacity-100 focus:opacity-100"}`} aria-label="مورد بعدی"><ChevronLeft size={20} /></button></>}
    </div>
  );
}
