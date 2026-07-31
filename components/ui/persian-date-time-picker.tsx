"use client";

import DatePicker, { DateObject } from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

export default function PersianDateTimePicker({ value, onChange, required = false, withTime = true }: { value: string; onChange: (value: string) => void; required?: boolean; withTime?: boolean }) {
  return <DatePicker calendar={persian} locale={persianFa} format={withTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD"} plugins={withTime ? [<TimePicker key="time" position="bottom" hideSeconds />] : []} value={value ? new Date(value) : undefined} onChange={(date: DateObject | null) => onChange(date ? date.toDate().toISOString() : "")} inputClass="w-full px-3 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" containerClassName="w-full" editable={false} required={required} calendarPosition="bottom-right" />;
}
