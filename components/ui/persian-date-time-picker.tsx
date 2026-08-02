"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, CalendarDays } from "lucide-react";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

const weekDays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function persianDate(value?: string) {
  return new DateObject({ date: value ? new Date(value) : new Date(), calendar: persian, locale: persianFa });
}

export default function PersianDateTimePicker({ value, onChange, required = false, withTime = true }: { value: string; onChange: (value: string) => void; required?: boolean; withTime?: boolean }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => persianDate(value));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = value ? persianDate(value) : null;
  const selectedKey = selected?.format("YYYY/MM/DD");
  const startOffset = new DateObject(view).toFirstOfMonth().weekDay.index;
  const days = Array.from({ length: view.month.length }, (_, index) => index + 1);
  const currentYear = persianDate().year;
  const years = Array.from({ length: 121 }, (_, index) => currentYear - index);

  useEffect(() => { if (value) setView(persianDate(value)); }, [value]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function selectDay(day: number) {
    const currentTime = selected?.toDate() || new Date();
    const next = new DateObject({ year: view.year, month: view.month.number, day, hour: currentTime.getHours(), minute: currentTime.getMinutes(), second: 0, calendar: persian, locale: persianFa });
    onChange(next.toDate().toISOString());
    setOpen(false);
  }

  function changeTime(nextTime: string) {
    if (!selected) return;
    const [hour, minute] = nextTime.split(":").map(Number);
    const next = selected.toDate();
    next.setHours(hour, minute, 0, 0);
    onChange(next.toISOString());
  }

  function setMonthOrYear(year: number, month: number) {
    setView(new DateObject({ year, month, day: 1, calendar: persian, locale: persianFa }));
  }

  return <div className="relative w-full" ref={wrapperRef}>
    <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm font-bold text-primary outline-none transition hover:border-secondary focus:border-secondary focus:ring-2 focus:ring-secondary-fixed" aria-expanded={open} aria-required={required}>
      <span className={value ? "" : "text-outline"}>{value ? `${selected?.format("YYYY/MM/DD")}${withTime ? `، ${selected?.format("HH:mm")}` : ""}` : "انتخاب تاریخ"}</span>
      <CalendarDays size={18} className="text-secondary" />
    </button>
    {open && <div className={`absolute right-0 z-[110] w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-primary/10 bg-white p-3 shadow-[0_20px_42px_-26px_rgba(3,0,75,0.5)] ${withTime ? "top-full mt-2" : "bottom-full mb-2"}`} dir="rtl">
      <div className="mb-3 flex items-center justify-between rounded-xl bg-primary px-3 py-2 text-white">
        <button type="button" onClick={() => setView((current) => new DateObject(current).add(1, "month"))} className="rounded-lg p-1.5 transition hover:bg-white/10" aria-label="ماه بعد"><ChevronRight size={18} /></button>
        <div className="flex items-center gap-1"><select value={view.month.number} onChange={(event) => setMonthOrYear(view.year, Number(event.target.value))} className="max-w-24 bg-transparent text-center text-xs font-black text-white outline-none"><>{monthNames.map((name, index) => <option key={name} value={index + 1} className="text-primary">{name}</option>)}</></select><select value={view.year} onChange={(event) => setMonthOrYear(Number(event.target.value), view.month.number)} className="w-16 bg-transparent text-center text-xs font-black text-white outline-none"><>{years.map((year) => <option key={year} value={year} className="text-primary">{year.toLocaleString("fa-IR", { useGrouping: false })}</option>)}</></select></div>
        <button type="button" onClick={() => setView((current) => new DateObject(current).subtract(1, "month"))} className="rounded-lg p-1.5 transition hover:bg-white/10" aria-label="ماه قبل"><ChevronLeft size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">{weekDays.map((name, index) => <span key={name} className={`py-1.5 text-[9px] font-black ${index === 6 ? "text-error" : "text-outline"}`}>{name}</span>)}{Array.from({ length: startOffset }).map((_, index) => <span key={`empty-${index}`} />)}{days.map((day) => { const key = `${view.year}/${String(view.month.number).padStart(2, "0")}/${String(day).padStart(2, "0")}`; const active = key === selectedKey; return <button key={day} type="button" onClick={() => selectDay(day)} className={`aspect-square rounded-lg text-xs font-bold transition ${active ? "bg-primary text-white shadow-md" : "text-primary hover:bg-secondary-fixed hover:text-primary"}`}>{day.toLocaleString("fa-IR")}</button>; })}</div>
      {withTime && <div className="mt-3 flex items-center gap-2 border-t border-surface-variant pt-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-fixed text-primary"><Clock3 size={15} /></span><label className="flex-1 text-xs font-bold text-primary">ساعت برگزاری<input type="time" value={selected?.format("HH:mm") || ""} onChange={(event) => changeTime(event.target.value)} disabled={!selected} className="mt-1 w-full rounded-lg border border-surface-variant px-2 py-1.5 text-sm disabled:bg-surface-low" /></label></div>}
    </div>}
  </div>;
}
