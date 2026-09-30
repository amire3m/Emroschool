"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  Layers,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type Status = "pending" | "approved" | "rejected";

interface Row {
  id: number;
  name: string;
  phone: string;
  course: string;
  amount: string;
  date: string;
  status: Status;
}

const ROWS: Row[] = [
  { id: 1, name: "نگار محمدی", phone: "0912 345 6789", course: "بازیگری مقدماتی", amount: "۱٬۲۵۰٬۰۰۰ تومان", date: "۲ شهریور", status: "pending" },
  { id: 2, name: "امیر رضایی", phone: "0935 111 2233", course: "کارگردانی سینما", amount: "۲٬۸۰۰٬۰۰۰ تومان", date: "۱ شهریور", status: "approved" },
  { id: 3, name: "سارا کریمی", phone: "0901 777 4455", course: "فیلم‌نامه‌نویسی", amount: "۹۵۰٬۰۰۰ تومان", date: "۳۱ مرداد", status: "pending" },
  { id: 4, name: "رضا احمدی", phone: "0919 222 8899", course: "تدوین پیشرفته", amount: "۱٬۶۰۰٬۰۰۰ تومان", date: "۳۰ مرداد", status: "rejected" },
  { id: 5, name: "مریم حسینی", phone: "0930 444 1122", course: "بازیگری مقدماتی", amount: "۱٬۲۵۰٬۰۰۰ تومان", date: "۲۹ مرداد", status: "approved" },
];

const STATUS_META: Record<Status, { label: string; className: string }> = {
  pending: { label: "در انتظار", className: "bg-amber-50 text-amber-700 border-amber-200/70" },
  approved: { label: "تأییدشده", className: "bg-emerald-50 text-emerald-700 border-emerald-200/70" },
  rejected: { label: "ردشده", className: "bg-red-50 text-red-600 border-red-200/70" },
};

function Badge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

const NAV = [
  { section: "اصلی", items: [{ label: "داشبورد", icon: LayoutDashboard, active: false }] },
  {
    section: "مدیریت",
    items: [
      { label: "درخواست‌های ثبت‌نام", icon: ClipboardList, active: true, badge: "۱۲" },
      { label: "پرداخت‌ها", icon: WalletCards, active: false },
      { label: "دوره‌ها", icon: BookOpen, active: false },
      { label: "کاربران", icon: Users, active: false },
    ],
  },
  {
    section: "سیستم",
    items: [
      { label: "اعلان‌ها", icon: Bell, active: false },
      { label: "تنظیمات", icon: Settings, active: false },
    ],
  },
];

export default function AdminLookSample() {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(
    () =>
      ROWS.filter(
        (r) =>
          (filter === "all" || r.status === filter) &&
          (query.trim() === "" || r.name.includes(query.trim()) || r.course.includes(query.trim())),
      ),
    [filter, query],
  );

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-900">
      {/* prototype banner */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-bold text-amber-800">
        پیش‌نمایش طراحی جدید پنل ادمین — نمونه تعاملی (داده‌ها ساختگی‌اند و تغییری در پنل واقعی ایجاد نشده است)
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        {/* sidebar */}
        <aside className="sticky top-6 hidden h-fit w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 md:block">
          <div className="flex items-center gap-3 px-2 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#03004b] text-lg font-black text-white">ا</span>
            <div>
              <p className="text-sm font-black text-slate-900">پنل مدیریت</p>
              <p className="text-[11px] text-slate-500">آکادمی امام روح‌الله</p>
            </div>
          </div>
          <nav className="space-y-5">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="px-3 pb-1.5 text-[11px] font-bold text-slate-400">{group.section}</p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${
                        item.active ? "bg-[#03004b] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <item.icon size={18} className={item.active ? "text-white" : "text-slate-400"} />
                      <span className="flex-1 text-right">{item.label}</span>
                      {"badge" in item && item.badge ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${item.active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#03004b] text-sm font-black text-white">م</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-900">مدیر سیستم</p>
              <p className="text-[11px] text-slate-500">نقش: مدیر ارشد</p>
            </div>
            <LogOut size={16} className="shrink-0 text-slate-400" />
          </div>
        </aside>

        {/* main */}
        <main className="min-w-0 flex-1">
          {/* page header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-slate-900 md:text-2xl">درخواست‌های ثبت‌نام</h1>
              <p className="mt-1 text-xs text-slate-500">بررسی، تأیید و مدیریت درخواست‌های دوره‌ها</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
              >
                <Download size={16} />
                خروجی
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-[#03004b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1b1c5e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
              >
                <Plus size={16} />
                درخواست جدید
              </button>
            </div>
          </div>

          {/* stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "در انتظار بررسی", value: "۱۲", sub: "۳ مورد امروز", tone: "bg-amber-50 text-amber-600" },
              { label: "تأییدشده این ماه", value: "۸۴", sub: "رشد ۱۲٪ نسبت به ماه قبل", tone: "bg-emerald-50 text-emerald-600" },
              { label: "مبلغ در انتظار", value: "۹٫۶ م", sub: "تومان", tone: "bg-blue-50 text-blue-600" },
              { label: "ردشده", value: "۳", sub: "نیازمند بازبینی", tone: "bg-red-50 text-red-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}>
                    <Layers size={19} />
                  </span>
                  <div>
                    <p className="text-xl font-black tabular-nums text-slate-900">{s.value}</p>
                    <p className="text-xs font-bold text-slate-600">{s.label}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-500">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* toolbar */}
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-72">
              <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو نام یا دوره..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15"
              />
            </div>
            <div className="flex gap-2">
              {(
                [
                  ["all", "همه"],
                  ["pending", "در انتظار"],
                  ["approved", "تأییدشده"],
                  ["rejected", "ردشده"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${
                    filter === value ? "bg-[#03004b] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-right">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500">متقاضی</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500">دوره</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500">مبلغ</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500">تاریخ</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500">وضعیت</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{r.name}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500" dir="ltr">{r.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{r.course}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-700">{r.amount}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{r.date}</td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
                        aria-label={`مشاهده ${r.name}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                      موردی با این فیلتر پیدا نشد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <p>نمایش {visible.length.toLocaleString("fa-IR")} مورد</p>
            <button type="button" onClick={() => setModalOpen(true)} className="font-bold text-[#03004b] underline-offset-4 hover:underline">
              نمایش مودال نمونه
            </button>
          </div>

          {/* tokens */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-black text-slate-900">توکن‌های پیشنهادی این طرح</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["پس‌زمینه", "#f4f6fa"],
                ["کارت", "#ffffff"],
                ["مرز", "#e2e8f0"],
                ["متن اصلی", "#0f172a"],
                ["متن فرعی", "#64748b"],
                ["آبی برند", "#03004b"],
                ["طلایی", "#7b5814"],
              ].map(([label, hex]) => (
                <span key={hex + label} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-600">
                  <i className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: hex }} dir="ltr">{null}</i>
                  {label} · <span dir="ltr" className="tabular-nums">{hex}</span>
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl md:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-[#7b5814]">درخواست ثبت‌نام</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">بازیگری مقدماتی</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="بستن">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["نام و نام خانوادگی", "نگار محمدی"],
                ["موبایل", "09123456789"],
                ["ایمیل", "negar@example.com"],
                ["استان و شهر", "تهران، تهران"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] font-bold text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">
                <Check size={16} />
                تأیید و ثبت در دوره
              </button>
              <button type="button" className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">
                رد درخواست
              </button>
              <button type="button" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
                بازگشت به انتظار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
