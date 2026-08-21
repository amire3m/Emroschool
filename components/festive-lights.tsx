"use client";

const COLORS = [
  "#ff5d5d", "#ffd23f", "#4ade80", "#60a5fa",
  "#c084fc", "#fb7185", "#34d399", "#fbbf24",
];

const BULBS = 14;

function wirePath(n: number): string {
  let d = "M 0 8";
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * 1200;
    const prevX = i === 0 ? 0 : ((i - 0.5) / n) * 1200;
    const midX = (prevX + x) / 2;
    d += ` Q ${midX} 40 ${x} 8`;
  }
  d += " L 1200 8";
  return d;
}

export default function FestiveLights() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-24 z-[70] h-[96px] select-none overflow-visible"
    >
      {/* Wire */}
      <svg className="absolute inset-x-0 top-0 h-full w-full" viewBox="0 0 1200 96" preserveAspectRatio="none">
        <path d={wirePath(BULBS)} fill="none" stroke="#14142b" strokeWidth="2.5" strokeOpacity="0.9" />
      </svg>

      {/* Bulbs */}
      {Array.from({ length: BULBS }, (_, i) => {
        const color = COLORS[i % COLORS.length];
        const x = ((i + 0.5) / BULBS) * 100;
        const delay = `${(i % 7) * 0.2}s`;
        const duration = `${2.6 + (i % 5) * 0.35}s`;
        return (
          <span key={i} className="absolute top-0 flex flex-col items-center" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
            {/* stem from wire */}
            <span className="h-[9px] w-px bg-[#14142b]/90" />
            {/* screw base */}
            <span className="h-[6px] w-[10px] rounded-[2px] bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500 shadow-sm" />
            {/* glass bulb */}
            <span
              className="relative -mt-px block h-[22px] w-[20px] rounded-[10px_10px_13px_13px]"
              style={{
                background: `radial-gradient(circle at 38% 30%, #ffffff, ${color} 55%, ${color}cc 90%)`,
                boxShadow: `0 0 10px 2px ${color}aa, 0 0 22px 6px ${color}44`,
                animation: `twinkle ${duration} ease-in-out ${delay} infinite`,
              }}
            >
              {/* inner filament glow */}
              <span className="absolute left-1/2 top-[6px] h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-white/90 blur-[1px]" />
              {/* bottom highlight */}
              <span className="absolute bottom-[3px] left-1/2 h-[4px] w-[8px] -translate-x-1/2 rounded-full bg-white/25 blur-[1px]" />
            </span>
          </span>
        );
      })}

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.7; filter: brightness(0.9); }
          50% { opacity: 1; filter: brightness(1.25); }
        }
        @media (prefers-reduced-motion: reduce) {
          span[style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
