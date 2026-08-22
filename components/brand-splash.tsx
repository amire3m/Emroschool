"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function BrandSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduced ? 1400 : 5400;
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
      {/* Framed video */}
      <div className="relative w-[min(88vw,760px)] overflow-hidden rounded-3xl border border-white/12 bg-black/40 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
        <div className="relative aspect-video">
          <video
            src="/videos/brand-splash.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            className="h-full w-full object-cover"
          />

          {/* Loading overlay */}
          {!videoReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0e1626]">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
                <Loader2 className="relative h-10 w-10 animate-spin text-white/70" />
              </div>
              <p className="text-xs font-bold tracking-wide text-white/45">در حال بارگذاری...</p>
            </div>
          )}

          {/* Loading bar */}
          {!videoReady && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <div className="h-full bg-white/70 animate-[loadbar_1.2s_ease-in-out_infinite]" />
            </div>
          )}
        </div>

        {/* Brand footer inside the frame */}
        <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-black/30 px-4 py-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffdeab] shadow-[0_0_6px_rgba(255,222,171,0.9)]" />
          <p className="text-xs font-bold text-white/60">آکادمی هنر و رسانه امام روح‌الله (ره)</p>
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffdeab] shadow-[0_0_6px_rgba(255,222,171,0.9)]" />
        </div>
      </div>

      <style>{`
        @keyframes loadbar {
          0% { width: 0%; }
          50% { width: 72%; }
          100% { width: 0%; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
