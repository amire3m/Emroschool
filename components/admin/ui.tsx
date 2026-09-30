"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-black text-slate-900 md:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-black tabular-nums text-slate-900">{value}</p>
          <p className="truncate text-xs font-bold text-slate-600">{label}</p>
        </div>
      </div>
      {sub ? <p className="mt-2.5 text-[11px] leading-5 text-slate-500">{sub}</p> : null}
    </article>
  );
}

export type BadgeTone = "amber" | "emerald" | "red" | "slate" | "blue" | "navy";

const BADGE_TONES: Record<BadgeTone, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200/70",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  red: "bg-red-50 text-red-600 border-red-200/70",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200/70",
  navy: "bg-[#03004b] text-white border-transparent",
};

export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${BADGE_TONES[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="px-4 py-12 text-center text-sm text-slate-500">{message}</p>;
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#03004b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1b1c5e] disabled:opacity-60 ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60 ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SearchInput({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 ${className}`}
      {...rest}
    />
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${FOCUS} ${
            value === opt.value
              ? "bg-[#03004b] text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  head,
  children,
  minWidth = 640,
}: {
  head: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-right">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, center = false, className = "" }: { children: ReactNode; center?: boolean; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-bold text-slate-500 ${center ? "text-center" : ""} ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return <td colSpan={colSpan} className={`px-4 py-3.5 ${className}`}>{children}</td>;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-2xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-2xl md:p-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS}`}
          >
            <X size={20} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">{footer}</div> : null}
      </div>
    </div>
  );
}
