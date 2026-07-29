"use client";

import { useRef, type CSSProperties, type HTMLAttributes, type PointerEvent } from "react";

export default function GlowingEdgeCard({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`group/glow relative rounded-2xl p-[1px] transition duration-500 hover:-translate-y-1 ${className}`}
      style={{
        "--glow-x": "50%",
        "--glow-y": "50%",
        background: "radial-gradient(260px circle at var(--glow-x) var(--glow-y), #ffdeab 0%, #7b5814 28%, #03004b 58%, #c7c5d2 100%)",
      } as CSSProperties}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 -z-10 rounded-[inherit] opacity-0 blur-xl transition-opacity duration-500 group-hover/glow:opacity-60"
        style={{
          background: "radial-gradient(220px circle at var(--glow-x) var(--glow-y), rgba(255,222,171,.95), rgba(123,88,20,.5) 35%, rgba(3,0,75,.22) 65%, transparent 78%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover/glow:opacity-100"
        style={{
          background: "radial-gradient(180px circle at var(--glow-x) var(--glow-y), rgba(255,222,171,.28), transparent 65%)",
        }}
      />
      <div className="relative h-full overflow-hidden rounded-[15px] bg-white shadow-sm transition-shadow duration-500 group-hover/glow:shadow-xl">
        {children}
      </div>
    </div>
  );
}
