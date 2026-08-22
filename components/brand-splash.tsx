"use client";

import { useEffect, useState } from "react";

export default function BrandSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduced ? 1200 : 5400;
    const t1 = window.setTimeout(() => setLeaving(true), holdMs);
    const t2 = window.setTimeout(() => setVisible(false), holdMs + 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[80] flex items-center justify-center bg-[linear-gradient(to_bottom,#162038,#0b1220)] transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <video
        src="/videos/brand-splash.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="h-full w-full object-contain p-4 md:p-10"
      />
    </div>
  );
}
