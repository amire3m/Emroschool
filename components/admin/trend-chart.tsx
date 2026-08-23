"use client";

import { useState, useMemo } from "react";

interface TrendPoint {
  date: string;
  visits: number;
  users: number;
  applications: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

const W = 800;
const H = 320;
const PAD = { top: 20, right: 16, bottom: 36, left: 50 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 2, 5, 10];
  for (const step of steps) {
    if (step * pow >= value) return step * pow;
  }
  return 10 * pow;
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cx = (points[i - 1].x + points[i].x) / 2;
    d += ` C ${cx} ${points[i - 1].y}, ${cx} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export default function TrendChart({ data }: TrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { visitsMax, usersMax, appsMax, visitsPoints, usersPoints, appsPoints, visitsAreaPath, visitsLinePath, usersLinePath, appsLinePath, gridLines, dateLabels, hoverX } = useMemo(() => {
    const visitsMax = niceMax(Math.max(1, ...data.map((d) => d.visits)));
    const usersMax = niceMax(Math.max(1, ...data.map((d) => d.users)));
    const appsMax = niceMax(Math.max(1, ...data.map((d) => d.applications)));
    const n = data.length;

    const xFor = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * INNER_W;
    const yVisits = (v: number) => PAD.top + INNER_H - (v / visitsMax) * INNER_H;
    const yUsers = (v: number) => PAD.top + INNER_H - (v / usersMax) * INNER_H;
    const yApps = (v: number) => PAD.top + INNER_H - (v / appsMax) * INNER_H;

    const visitsPoints = data.map((d, i) => ({ x: xFor(i), y: yVisits(d.visits) }));
    const usersPoints = data.map((d, i) => ({ x: xFor(i), y: yUsers(d.users) }));
    const appsPoints = data.map((d, i) => ({ x: xFor(i), y: yApps(d.applications) }));

    const visitsLinePath = smoothPath(visitsPoints);
    const visitsAreaPath = `${visitsLinePath} L ${visitsPoints[visitsPoints.length - 1]?.x || PAD.left} ${PAD.top + INNER_H} L ${PAD.left} ${PAD.top + INNER_H} Z`;
    const usersLinePath = smoothPath(usersPoints);
    const appsLinePath = smoothPath(appsPoints);

    const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: PAD.top + INNER_H * (1 - ratio),
      label: Math.round(visitsMax * ratio).toLocaleString("fa-IR"),
    }));

    const dateLabels: Array<{ x: number; label: string }> = [];
    for (let i = 0; i < n; i += 5) {
      const d = new Date(data[i].date);
      dateLabels.push({ x: xFor(i), label: `${d.getDate()}/${d.getMonth() + 1}` });
    }

    return { visitsMax, usersMax, appsMax, visitsPoints, usersPoints, appsPoints, visitsAreaPath, visitsLinePath, usersLinePath, appsLinePath, gridLines, dateLabels, hoverX: xFor(hoverIndex ?? 0) };
  }, [data]);

  const hoverData = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverDate = hoverData ? new Date(hoverData.date).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="نمودار روند ۳۰ روزه">
        {/* Grid lines */}
        {gridLines.map((gl, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={gl.y} y2={gl.y} stroke="#e2e2f0" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.left - 8} y={gl.y + 4} textAnchor="end" fontSize={10} fill="#999" fontWeight={600}>{gl.label}</text>
          </g>
        ))}
        {/* Baseline */}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + INNER_H} y2={PAD.top + INNER_H} stroke="#ccc" strokeWidth={1.5} />

        {/* Visits area */}
        <path d={visitsAreaPath} fill="url(#visitsGrad)" opacity={0.25} />
        <defs>
          <linearGradient id="visitsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Visits line */}
        <path d={visitsLinePath} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" />

        {/* Users line */}
        <path d={usersLinePath} fill="none" stroke="#03004b" strokeWidth={2} strokeLinecap="round" />
        {usersPoints.map((pt, i) => data[i].users > 0 && <circle key={`u${i}`} cx={pt.x} cy={pt.y} r={3} fill="#03004b" stroke="white" strokeWidth={1.5} />)}

        {/* Applications line */}
        <path d={appsLinePath} fill="none" stroke="#b8860b" strokeWidth={2} strokeLinecap="round" />
        {appsPoints.map((pt, i) => data[i].applications > 0 && <circle key={`a${i}`} cx={pt.x} cy={pt.y} r={3} fill="#b8860b" stroke="white" strokeWidth={1.5} />)}

        {/* Hover vertical line */}
        {hoverIndex !== null && (
          <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + INNER_H} stroke="#03004b" strokeWidth={1} strokeOpacity={0.2} />
        )}

        {/* Date labels */}
        {dateLabels.map((dl, i) => (
          <text key={i} x={dl.x} y={H - 12} textAnchor="middle" fontSize={10} fill="#999" fontWeight={600}>{dl.label}</text>
        ))}

        {/* Hover hit areas */}
        {data.map((_, i) => {
          const x0 = PAD.left + (i / data.length) * INNER_W;
          const x1 = PAD.left + ((i + 1) / data.length) * INNER_W;
          return <rect key={i} x={x0} y={PAD.top} width={x1 - x0} height={INNER_H} fill="transparent" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} />;
        })}
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && hoverData && (
        <div
          className="pointer-events-none absolute z-20 rounded-xl bg-primary px-4 py-3 text-xs text-white shadow-2xl"
          style={{
            left: `${(hoverX / W) * 100}%`,
            top: 0,
            transform: `translateX(${hoverX > W * 0.7 ? "-110%" : "10%"})`,
          }}
          dir="rtl"
        >
          <p className="mb-2 font-black text-secondary-fixed">{hoverDate}</p>
          <div className="space-y-1">
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#60a5fa]" />بازدید: <b>{hoverData.visits.toLocaleString("fa-IR")}</b></p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white" />کاربر جدید: <b>{hoverData.users.toLocaleString("fa-IR")}</b></p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#b8860b]" />درخواست: <b>{hoverData.applications.toLocaleString("fa-IR")}</b></p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-5 text-xs text-outline" dir="rtl">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#60a5fa]" />بازدید</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#03004b]" />کاربران جدید</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#b8860b]" />درخواست دوره</span>
      </div>
    </div>
  );
}
