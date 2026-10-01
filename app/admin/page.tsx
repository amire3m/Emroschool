"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Banknote, ClipboardList, Eye, GraduationCap, Loader2, TrendingUp, Users, XCircle, LifeBuoy, Newspaper, BarChart3 } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import { APP_VERSION, releaseNotes } from "@/lib/version";
import TrendChart from "@/components/admin/trend-chart";
import { Badge, PageHeader, PrimaryButton, StatCard } from "@/components/admin/ui";

type Report = {
  summary: {
    usersTotal: number; usersToday: number; usersMonth: number; completedRegistrations: number;
    applicationsTotal: number; applicationsPending: number; applicationsApproved: number; applicationsRejected: number;
    enrollmentTotal: number; uniqueApplicants: number; paidOrders: number; paidAmountTomans: number; pendingPayments: number;
    revenueMonth: number;
    visitsToday: number; visitorsToday: number; visitsWeek: number; visitorsWeek: number;
    visitsMonth: number; visitorsMonth: number; visitsTotal: number; visitorsTotal: number;
    supportOpen: number; supportTotal: number; newsCount: number;
  };
  trend: Array<{ date: string; users: number; applications: number; visits: number; visitors: number }>;
  recentApplications: Array<{ id: string; fullName: string; status: string; createdAt: string; finalAmountTomans: number; course: { title: string } }>;
  topCourses: Array<{ id: string; title: string; slug: string; price: number; enrollments: number }>;
};

const statusLabel: Record<string, string> = { pending: "در انتظار بررسی", pending_payment: "در انتظار پرداخت", approved: "تأییدشده", rejected: "ردشده" };

export default function AdminDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getCookie("token");
    if (!token) return;
    fetch("/api/admin/reports", { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(setReport)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "دریافت گزارش ناموفق بود"));
  }, []);

  if (error) return <div className="flex h-64 items-center justify-center gap-2 text-red-600"><AlertCircle size={20} />{error}</div>;
  if (!report) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-[#03004b]" /></div>;

  const { summary } = report;

  const topCourseMax = Math.max(1, ...report.topCourses.map((c) => c.enrollments));

  return <div className="space-y-6" dir="rtl">
    <PageHeader
      title="گزارش مدیریت"
      subtitle="بازدید، کاربران، ثبتنامها، درآمد و دورهها در یک نگاه."
      actions={<Link href="/admin/applications"><PrimaryButton>بررسی درخواستها</PrimaryButton></Link>}
    />

    {/* Visit stats */}
    <section>
      <div className="mb-3 flex items-center gap-2"><Eye size={18} className="text-slate-400" /><h2 className="text-base font-black text-slate-900">بازدید سایت</h2></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["امروز", summary.visitsToday, summary.visitorsToday],
          ["این هفته", summary.visitsWeek, summary.visitorsWeek],
          ["این ماه", summary.visitsMonth, summary.visitorsMonth],
          ["کل", summary.visitsTotal, summary.visitorsTotal],
        ].map(([label, views, visitors]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{Number(views).toLocaleString("fa-IR")}</p>
            <p className="mt-1 text-[11px] text-slate-500">{Number(visitors).toLocaleString("fa-IR")} بازدیدکننده یکتا</p>
          </div>
        ))}
      </div>
    </section>

    {/* Key stats */}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="کاربران کل" value={summary.usersTotal.toLocaleString("fa-IR")} sub={`${summary.usersToday.toLocaleString("fa-IR")} کاربر جدید امروز`} icon={Users} tone="bg-slate-100 text-slate-600" />
      <StatCard label="درآمد این ماه" value={summary.revenueMonth.toLocaleString("fa-IR")} sub={`${summary.paidAmountTomans.toLocaleString("fa-IR")} تومان کل درآمد`} icon={Banknote} tone="bg-emerald-50 text-emerald-600" />
      <StatCard label="درخواستهای دوره" value={summary.applicationsTotal.toLocaleString("fa-IR")} sub={`${summary.applicationsPending.toLocaleString("fa-IR")} مورد در انتظار`} icon={ClipboardList} tone="bg-amber-50 text-amber-600" />
      <StatCard label="ثبتنام قطعی دوره" value={summary.enrollmentTotal.toLocaleString("fa-IR")} sub={`${summary.applicationsApproved.toLocaleString("fa-IR")} تأییدشده`} icon={GraduationCap} tone="bg-emerald-50 text-emerald-600" />
      <StatCard label="تیکت پشتیبانی باز" value={summary.supportOpen.toLocaleString("fa-IR")} sub={`${summary.supportTotal.toLocaleString("fa-IR")} تیکت کل`} icon={LifeBuoy} tone="bg-amber-50 text-amber-600" />
      <StatCard label="مقالات مجله" value={summary.newsCount.toLocaleString("fa-IR")} sub="محتوای منتشرشده" icon={Newspaper} tone="bg-blue-50 text-blue-600" />
      <StatCard label="پرداخت موفق" value={summary.paidOrders.toLocaleString("fa-IR")} sub={`${summary.paidAmountTomans.toLocaleString("fa-IR")} تومان`} icon={Banknote} tone="bg-emerald-50 text-emerald-600" />
      <StatCard label="درخواست ردشده" value={summary.applicationsRejected.toLocaleString("fa-IR")} sub="نیازمند بررسی مجدد" icon={XCircle} tone="bg-red-50 text-red-500" />
    </section>

    {/* Trend chart with visits */}
    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6"><div className="flex items-center gap-2"><TrendingUp size={20} className="text-slate-400" /><div><h2 className="font-black text-slate-900">روند ۳۰ روز اخیر</h2><p className="mt-1 text-xs text-slate-500">بازدید، کاربران جدید و درخواستهای ثبتنام</p></div></div><div className="mt-5"><TrendChart data={report.trend} /></div></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-900">آخرین درخواست‌ها</h2><p className="mt-1 text-xs text-slate-500">آخرین متقاضیان دوره</p></div><Link href="/admin/applications" className="text-xs font-bold text-[#03004b] underline-offset-4 hover:underline">مشاهده همه</Link></div><div className="mt-5 divide-y divide-slate-100">{report.recentApplications.map((item) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.fullName}</p><p className="mt-1 truncate text-xs text-slate-500">{item.course.title}</p></div><Badge tone={item.status === "approved" ? "emerald" : item.status === "rejected" ? "red" : "amber"}>{statusLabel[item.status] || item.status}</Badge></div></div>)}{report.recentApplications.length === 0 && <p className="py-8 text-center text-sm text-slate-500">هنوز درخواستی ثبت نشده است.</p>}</div></div></section>

    {/* Top courses */}
    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex items-center gap-2 mb-5"><BarChart3 size={20} className="text-slate-400" /><div><h2 className="font-black text-slate-900">محبوبترین دورهها</h2><p className="mt-1 text-xs text-slate-500">بر اساس تعداد دانشجوی ثبتنامشده</p></div></div>
      <div className="space-y-3">
        {report.topCourses.map((course, index) => (
          <div key={course.id} className="flex items-center gap-4">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${index === 0 ? "bg-[#03004b] text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-bold text-slate-900">{course.title}</p>
                <p className="shrink-0 text-xs font-black tabular-nums text-slate-700">{course.enrollments.toLocaleString("fa-IR")} دانشجو</p>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-[#03004b] transition-all duration-500" style={{ width: `${(course.enrollments / topCourseMax) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-black text-slate-900">آخرین بروزرسانی‌ها</h2><p className="mt-1 text-xs text-slate-500">سامانه روی نسخه {APP_VERSION} است</p></div><Link href="/admin/updates" className="text-sm font-bold text-[#03004b] underline-offset-4 hover:underline">مشاهده همه</Link></div><div className="space-y-3">{releaseNotes.slice(0, 3).map((note) => <div key={note.id} className="flex items-start justify-between gap-4 rounded-lg bg-slate-50 p-4"><div><p className="text-sm font-bold text-slate-900">{note.title}</p><p className="mt-1 text-xs text-slate-500">{note.summary}</p></div><time className="whitespace-nowrap text-[11px] text-slate-500">{new Date(note.publishedAt).toLocaleDateString("fa-IR")}</time></div>)}</div></section>
  </div>;
}
