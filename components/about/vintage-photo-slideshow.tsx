"use client";

import { useEffect, useState } from "react";

const slides = [
  { src: "/images/about/imam-portrait.jpg", alt: "تصویر امام خمینی در قاب آرشیوی", caption: "روایت یک مسیر" },
  { src: "/images/about/imam-speech.jpg", alt: "تصویر امام خمینی در حال سخنرانی", caption: "صدایی برای فردا" },
  { src: "/images/about/imam-prayer.jpg", alt: "تصویر امام خمینی در حال دعا", caption: "ریشه در ایمان" },
];

export default function VintagePhotoSlideshow() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="relative mx-auto h-[22rem] w-64 md:h-[28rem] md:w-80" aria-label="تصاویر آرشیوی آکادمی">
    <div className="absolute inset-5 rotate-6 rounded-sm border border-secondary-fixed/20 bg-[#d5c6a6]/15" />
    <div className="absolute inset-4 -rotate-3 rounded-sm border border-white/10 bg-primary/80" />
    <div className="relative h-full -rotate-1 overflow-hidden rounded-sm bg-[#e5d9bd] p-2 shadow-[18px_24px_0_rgba(0,0,0,0.18),0_30px_55px_-18px_rgba(0,0,0,0.8)] transition-transform duration-700 hover:rotate-0">
      <div className="relative h-full overflow-hidden border border-[#5a482d]/30 bg-[#1b130b]">
        {slides.map((slide, index) => <img key={slide.src} src={slide.src} alt={slide.alt} className={`absolute inset-0 h-full w-full object-cover sepia-[.24] contrast-[.9] saturate-[.72] transition-all duration-1000 ${index === activeSlide ? "scale-100 opacity-100" : "scale-110 opacity-0"}`} />)}
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,235,188,0.18),transparent_38%,rgba(24,13,5,0.4))] mix-blend-overlay" />
      </div>
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between border-t border-[#5a482d]/20 bg-[#e5d9bd] px-3 py-2 text-[#382b1b]">
        <span className="text-[10px] font-black tracking-[.12em]">{slides[activeSlide].caption}</span>
        <span className="text-[10px] font-bold">۰{activeSlide + 1} / ۰{slides.length}</span>
      </div>
    </div>
    <div className="absolute -bottom-4 -left-3 flex gap-1.5 rounded-full border border-white/15 bg-primary/90 px-3 py-2 shadow-lg">
      {slides.map((slide, index) => <button key={slide.src} type="button" onClick={() => setActiveSlide(index)} aria-label={`نمایش تصویر ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === activeSlide ? "w-5 bg-secondary-fixed" : "w-1.5 bg-white/40 hover:bg-white"}`} />)}
    </div>
  </div>;
}
