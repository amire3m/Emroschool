"use client";

import { cn } from "@/lib/utils";
import { motion, type TargetAndTransition, type Transition } from "motion/react";
import type { CSSProperties } from "react";

export type GlowEffectProps = {
  className?: string;
  style?: CSSProperties;
  colors?: string[];
  mode?: "rotate" | "pulse" | "breathe" | "colorShift" | "flowHorizontal" | "static";
  blur?: number | "softest" | "soft" | "medium" | "strong" | "stronger" | "strongest" | "none";
  transition?: Transition;
  scale?: number;
  duration?: number;
};

export function GlowEffect({
  className,
  style,
  colors = ["#03004b", "#7b5814", "#ffdeab", "#56589b"],
  mode = "rotate",
  blur = "medium",
  transition,
  scale = 1,
  duration = 5,
}: GlowEffectProps) {
  const baseTransition: Transition = { repeat: Infinity, duration, ease: "linear" };
  const mirrorTransition: Transition = { ...baseTransition, repeatType: "mirror" };
  const animations: Record<NonNullable<GlowEffectProps["mode"]>, TargetAndTransition> = {
    rotate: {
      background: [
        `conic-gradient(from 0deg at 50% 50%, ${colors.join(", ")})`,
        `conic-gradient(from 360deg at 50% 50%, ${colors.join(", ")})`,
      ],
      transition: transition || baseTransition,
    },
    pulse: {
      background: colors.map((color) => `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`),
      scale: [scale, 1.08 * scale, scale],
      opacity: [0.45, 0.8, 0.45],
      transition: transition || mirrorTransition,
    },
    breathe: {
      background: colors.map((color) => `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`),
      scale: [scale, 1.04 * scale, scale],
      transition: transition || mirrorTransition,
    },
    colorShift: {
      background: colors.map((color, index) => {
        const nextColor = colors[(index + 1) % colors.length];
        return `conic-gradient(from 0deg at 50% 50%, ${color} 0%, ${nextColor} 50%, ${color} 100%)`;
      }),
      transition: transition || mirrorTransition,
    },
    flowHorizontal: {
      background: colors.map((color, index) => `linear-gradient(to right, ${color}, ${colors[(index + 1) % colors.length]})`),
      transition: transition || mirrorTransition,
    },
    static: { background: `linear-gradient(to right, ${colors.join(", ")})` },
  };
  const blurClasses = {
    softest: "blur-sm",
    soft: "blur",
    medium: "blur-md",
    strong: "blur-lg",
    stronger: "blur-xl",
    strongest: "blur-2xl",
    none: "blur-none",
  };

  return (
    <motion.div
      style={{
        ...style,
        ...(typeof blur === "number" ? { filter: `blur(${blur}px)` } : {}),
        "--glow-scale": scale,
        willChange: "transform, background, opacity",
        backfaceVisibility: "hidden",
      } as CSSProperties}
      animate={animations[mode]}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full scale-[var(--glow-scale)] transform-gpu",
        typeof blur === "number" ? "" : blurClasses[blur],
        className,
      )}
    />
  );
}
