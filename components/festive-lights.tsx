"use client";

const COLORS = [
  "#ff5d5d", "#ffd23f", "#4ade80", "#60a5fa",
  "#c084fc", "#fb7185", "#34d399", "#fbbf24",
];

const BULBS = 16;

function wirePath(n: number): string {
  let d = "M 0 8";
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * 1200;
    const prevX = i === 0 ? 0 : ((i - 0.5) / n) * 1200;
    const midX = (prevX + x) / 2;
    d += ` Q ${midX} 42 ${x} 8`;
  }
  d += " L 1200 8";
  return d;
}

export default function FestiveLights() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-24 z-[70] h-[104px] select-none overflow-visible"
    >
      {/* Ambient glow behind the garland */}
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,222,171,0.10),transparent_70%)]" />

      {/* Wire */}
      <svg className="absolute inset-x-0 top-0 h-full w-full" viewBox="0 0 1200 104" preserveAspectRatio="none">
        <path d={wirePath(BULBS)} fill="none" stroke="#14142b" strokeWidth="3" strokeOpacity="0.95" />
        <path d={wirePath(BULBS)} fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.14" transform="translate(0 1.5)" />
      </svg>

      {/* Traveling glint along the wire */}
      <div className="absolute top-[7px] h-[3px] w-24 rounded-full bg-[radial-gradient(ellipse,#ffd23f,transparent_70%)] opacity-80 animate-[glint_9s_linear_infinite]" />

      {/* Bulbs */}
      {Array.from({ length: BULBS }, (_, i) => {
        const color = COLORS[i % COLORS.length];
        const x = ((i + 0.5) / BULBS) * 100;
        const delay = `${(i % 7) * 0.18}s`;
        const duration = `${2.8 + (i % 5) * 0.4}s`;
        return (
          <span key={i} className="absolute top-0 flex flex-col items-center" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
            {/* stem */}
            <span className="h-[8px] w-px bg-gradient-to-b from-[#14142b] to-[#2c2c4a]" />
            {/* screw base */}
            <span className="h-[6px] w-[11px] rounded-[2px] bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            {/* glass bulb */}
            <span
              className="relative -mt-px block h-[24px] w-[22px] rounded-[11px_11px_14px_14px]"
              style={{
                background: `radial-gradient(circle at 34% 28%, #ffffff, ${color} 46%, ${color}ee 82%)`,
                boxShadow: `0 0 12px 3px ${color}88, 0 0 28px 9px ${color}33, inset 0 -4px 8px rgba(0,0,0,0.25)`,
                animation: `twinkle ${duration} ease-in-out ${delay} infinite`,
              }}
            >
              {/* gloss streak */}
              <span className="absolute left-[4px] top-[5px] h-[9px] w-[5px] rounded-full bg-white/80 blur-[0.5px]" />
              {/* warm core */}
              <span className="absolute left-1/2 top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 blur-[2px]" />
              {/* bottom reflection */}
              <span className="absolute bottom-[3px] left-1/2 h-[4px] w-[9px] -translate-x-1/2 rounded-full bg-white/25 blur-[1px]" />
            </span>
          </span>
        );
      })}

      {/* Hanging ornament */}
      <div className="absolute left-[28%] top-0 flex -translate-x-1/2 flex-col items-center">
        <span className="h-[16px] w-px bg-[#14142b]/85" />
        {/* gold bead */}
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
        <span className="h-[3px] w-px bg-[#14142b]/70" />
        <img
          src="/icons/ornament.svg"
          alt=""
          aria-hidden="true"
          className="h-[68px] w-[68px] origin-top animate-[sway_6s_ease-in-out_infinite] drop-shadow-[0_10px_16px_rgba(0,0,0,0.4)] md:h-[84px] md:w-[84px]"
        />
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.75; filter: brightness(0.92) saturate(1); }
          50% { opacity: 1; filter: brightness(1.35) saturate(1.25); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(-4.5deg); }
          50% { transform: rotate(4.5deg); }
        }
        @keyframes glint {
          0% { left: -10%; opacity: 0; }
          8% { opacity: 0.9; }
          92% { opacity: 0.9; }
          100% { left: 102%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          span[style*="animation"], img[style*="animation"], div[style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
