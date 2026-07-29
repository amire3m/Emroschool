"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { ChevronLeft, ChevronRight, Expand, FolderOpen, Images } from "lucide-react";

export interface AutoScrollGalleryItem {
  id: string;
  imageUrl: string;
  altText?: string | null;
  folder?: string | null;
}

export default function AutoScrollSlider({
  items,
  onSelect,
}: {
  items: AutoScrollGalleryItem[];
  onSelect?: (item: AutoScrollGalleryItem) => void;
}) {
  const autoScroll = useRef(
    AutoScroll({
      speed: 1.4,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
      startDelay: 400,
    }),
  );
  const [viewportRef, api] = useEmblaCarousel(
    { loop: true, direction: "rtl", align: "start", dragFree: true },
    [autoScroll.current],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSlideChange = useCallback(() => {
    if (api) setSelectedIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSlideChange();
    api.on("select", onSlideChange);
    api.on("reInit", onSlideChange);
    return () => {
      api.off("select", onSlideChange);
      api.off("reInit", onSlideChange);
    };
  }, [api, onSlideChange]);

  if (items.length === 0) return null;

  return (
    <div className="relative" dir="rtl">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-surface-low to-transparent md:w-20"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-surface-low to-transparent md:w-20"
        aria-hidden="true"
      />

      <div ref={viewportRef} className="overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="flex touch-pan-y gap-3 md:gap-5">
          {items.map((item, index) => {
            const wide = index % 4 === 1 || index % 4 === 3;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect?.(item)}
                className={`group relative h-[280px] min-w-0 shrink-0 overflow-hidden rounded-2xl bg-primary text-right shadow-sm md:h-[420px] md:rounded-3xl ${
                  wide
                    ? "basis-[86%] sm:basis-[68%] lg:basis-[56%]"
                    : "basis-[62%] sm:basis-[42%] lg:basis-[30%]"
                }`}
                aria-label={`نمایش تصویر ${item.altText || index + 1}`}
              >
                <img
                  src={item.imageUrl}
                  alt={item.altText || "تصویر گالری"}
                  draggable={false}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/5 to-transparent opacity-70 transition-opacity group-hover:opacity-95" />

                {item.folder && (
                  <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-primary/55 px-3 py-1.5 text-xs text-white backdrop-blur-md md:right-4 md:top-4">
                    <FolderOpen size={13} />
                    {item.folder}
                  </span>
                )}

                <span className="absolute left-3 top-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white opacity-0 backdrop-blur-md transition-all group-hover:translate-y-0 group-hover:opacity-100 md:left-4 md:top-4">
                  <Expand size={17} />
                </span>

                <span className="absolute inset-x-0 bottom-0 translate-y-2 p-4 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 md:p-6">
                  <span className="block text-sm font-bold md:text-base">{item.altText || "آکادمی هنر و رسانه"}</span>
                  <span className="mt-1 block text-xs text-white/65">برای نمایش کامل کلیک کنید</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => api?.scrollPrev()}
            className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-primary/70 text-white shadow-lg backdrop-blur-md transition hover:bg-primary md:flex"
            aria-label="تصویر قبلی"
          >
            <ChevronRight size={21} />
          </button>
          <button
            type="button"
            onClick={() => api?.scrollNext()}
            className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-primary/70 text-white shadow-lg backdrop-blur-md transition hover:bg-primary md:flex"
            aria-label="تصویر بعدی"
          >
            <ChevronLeft size={21} />
          </button>
        </>
      )}

      <div className="mt-5 flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2 text-xs text-outline">
          <Images size={15} className="text-secondary" />
          <span>{items.length.toLocaleString("fa-IR")} تصویر</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant" />
          <span>حرکت خودکار؛ برای توقف نشانگر را روی تصویر نگه دارید</span>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
          {(selectedIndex + 1).toLocaleString("fa-IR")} / {items.length.toLocaleString("fa-IR")}
        </span>
      </div>
    </div>
  );
}
