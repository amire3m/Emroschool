"use client";

import { useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";

export interface AutoScrollGalleryItem {
  id: string;
  imageUrl: string;
  altText?: string | null;
  folder?: string | null;
  title?: string | null;
  description?: string | null;
  slug?: string | null;
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
      speed: 2,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
      startDelay: 100,
    }),
  );
  const [viewportRef] = useEmblaCarousel(
    { loop: true, direction: "rtl", align: "start", dragFree: true },
    [autoScroll.current],
  );

  if (items.length === 0) return null;

  return (
    <div className="w-full" dir="rtl">
      <div ref={viewportRef} className="overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="flex h-[180px] touch-pan-y gap-2 md:h-[240px] md:gap-3">
          {items.map((item, index) => {
            const wide = index % 2 === 1;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect?.(item)}
                className={`group relative h-full min-w-0 shrink-0 overflow-hidden rounded-xl bg-surface-variant ${
                  wide
                    ? "basis-[72%] sm:basis-[46%] lg:basis-[34%]"
                    : "basis-[52%] sm:basis-[32%] lg:basis-[22%]"
                }`}
                aria-label={`نمایش تصویر ${item.altText || index + 1}`}
              >
                <img
                  src={item.imageUrl}
                  alt={item.altText || "تصویر گالری"}
                  draggable={false}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {(item.title || item.altText) && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12 text-right text-white opacity-0 transition-opacity group-hover:opacity-100"><strong className="block text-sm">{item.title || item.altText}</strong>{item.description && <small className="block text-white/65 mt-1 line-clamp-1">{item.description}</small>}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
