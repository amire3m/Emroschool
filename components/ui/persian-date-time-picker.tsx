"use client";

import DatePicker, { DateObject } from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import { useRef } from "react";

export default function PersianDateTimePicker({ value, onChange, required = false, withTime = true }: { value: string; onChange: (value: string) => void; required?: boolean; withTime?: boolean }) {
  const pickerRef = useRef<{ closeCalendar: () => void }>(null);
  return <DatePicker ref={pickerRef} calendar={persian} locale={persianFa} weekDays={["ش", "ی", "د", "س", "چ", "پ", "ج"]} format={withTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD"} plugins={withTime ? [<TimePicker key="time" position="bottom" hideSeconds />] : []} value={value ? new Date(value) : undefined} onChange={(date: DateObject | null) => { onChange(date ? date.toDate().toISOString() : ""); if (!withTime) pickerRef.current?.closeCalendar(); }} inputClass="w-full px-4 py-3 rounded-xl border border-surface-variant bg-white text-sm font-bold text-primary outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary-fixed" containerClassName="w-full" className="persian-date-picker" editable={false} required={required} calendarPosition="bottom-right" />;
}
