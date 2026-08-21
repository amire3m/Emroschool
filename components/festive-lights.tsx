"use client";

const COLORS = [
  "#ff5d5d", "#ffd23f", "#4ade80", "#60a5fa",
  "#c084fc", "#fb7185", "#34d399", "#fbbf24",
];

const BULBS = 14;

function wirePath(n: number): string {
  let d = "M 0 10";
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * 1200;
    const prevX = i === 0 ? 0 : ((i - 0.5) / n) * 1200;
    const midX = (prevX + x) / 2;
    d += ` Q ${midX} 42 ${x} 10`;
  }
  d += " L 1200 10";
  return d;
}

export default function FestiveLights() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-16 select-none overflow-visible"
    >
      {/* Wire */}
      <svg className="absolute inset-x-0 top-0 h-full w-full" viewBox="0 0 1200 64" preserveAspectRatio="none">
        <path d={wirePath(BULBS)} fill="none" stroke="#14142b" strokeWidth="2" strokeOpacity="0.85" />
      </svg>

      {/* Bulbs */}
      {Array.from({ length: BULBS }, (_, i) => {
        const color = COLORS[i % COLORS.length];
        const x = ((i + 0.5) / BULBS) * 100;
        const delay = `${(i % 7) * 0.18}s`;
        const duration = `${2.4 + (i % 5) * 0.35}s`;
        return (
          <span key={i} className="absolute top-0" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
            {/* stem */}
            <span className="mx-auto block h-[10px] w-px bg-[#14142b]/80" />
            {/* bulb */}
            <span
              className="relative -mt-px block h-4 w-4 rounded-full"
              style={{
                background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${color} 60%)`,
                boxShadow: `0 0 8px 2px ${color}aa, 0 0 18px 4px ${color}55`,
                animation: `twinkle ${duration} ease-in-out ${delay} infinite`,
              }}
            >
              <span className="absolute left-[3px] top-[2px] h-[3px] w-[5px] rounded-full bg-white/70 blur-[0.5px]" />
            </span>
          </span>
        );
      })}

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          span[style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
