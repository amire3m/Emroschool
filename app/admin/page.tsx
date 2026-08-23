"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Banknote, BookOpen, CheckCircle2, ClipboardList, CreditCard, Eye, GraduationCap, Loader2, TrendingUp, UserPlus, Users, XCircle, LifeBuoy, Newspaper, BarChart3 } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import { APP_VERSION, releaseNotes } from "@/lib/version";

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

  if (error) return <div className="flex h-64 items-center justify-center gap-2 text-error"><AlertCircle size={20} />{error}</div>;
  if (!report) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  const { summary } = report;
  const stats = [
    ["بازدید امروز", summary.visitsToday, `${summary.visitorsToday.toLocaleString("fa-IR")} بازدیدکننده یکتا`, Eye, "bg-[#eaf5ff] text-blue-700"],
    ["بازدید این هفته", summary.visitsWeek, `${summary.visitorsWeek.toLocaleString("fa-IR")} بازدیدکننده یکتا`, BarChart3, "bg-[#e2e1f0] text-primary"],
    ["بازدید این ماه", summary.visitsMonth, `${summary.visitorsMonth.toLocaleString("fa-IR")} بازدیدکننده یکتا`, TrendingUp, "bg-[#e8f7ee] text-green-700"],
    ["کل بازدیدها", summary.visitsTotal, `${summary.visitorsTotal.toLocaleString("fa-IR")} بازدیدکننده کل`, Eye, "bg-[#eeecfc] text-primary"],
    ["کاربران کل", summary.usersTotal, `${summary.usersToday.toLocaleString("fa-IR")} کاربر جدید امروز`, Users, "bg-[#eeecfc] text-primary"],
    ["درآمد این ماه", summary.revenueMonth, `${summary.paidAmountTomans.toLocaleString("fa-IR")} تومان کل درآمد`, Banknote, "bg-[#e8f7ee] text-green-700"],
    ["درخواستهای دوره", summary.applicationsTotal, `${summary.applicationsPending.toLocaleString("fa-IR")} مورد در انتظار`, ClipboardList, "bg-[#fff4df] text-secondary"],
    ["ثبتنام قطعی دوره", summary.enrollmentTotal, `${summary.applicationsApproved.toLocaleString("fa-IR")} تأییدشده`, GraduationCap, "bg-[#e8f7ee] text-green-700"],
    ["تیکت پشتیبانی باز", summary.supportOpen, `${summary.supportTotal.toLocaleString("fa-IR")} تیکت کل`, LifeBuoy, "bg-[#fff4df] text-secondary"],
    ["مقالات مجله", summary.newsCount, "محتوای منتشرشده", Newspaper, "bg-[#eaf5ff] text-blue-700"],
    ["پرداخت موفق", summary.paidOrders, `${summary.paidAmountTomans.toLocaleString("fa-IR")} تومان`, Banknote, "bg-[#e8f7ee] text-green-700"],
    ["درخواست ردشده", summary.applicationsRejected, "نیازمند بررسی مجدد", XCircle, "bg-error-container text-error"],
  ] as const;

  const chartMax = Math.max(1, ...report.trend.flatMap((item) => [item.visits, item.users, item.applications]));
  const topCourseMax = Math.max(1, ...report.topCourses.map((c) => c.enrollments));

  return <div className="space-y-7" dir="rtl">
    <section className="rounded-[1.8rem] bg-primary p-6 text-white md:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-secondary-fixed">نمای کلی آکادمی</p><h1 className="mt-2 text-2xl font-black">گزارش مدیریت</h1><p className="mt-2 text-sm text-white/65">بازدید، کاربران، ثبتنامها، درآمد و دورهها در یک نگاه.</p></div><Link href="/admin/applications" className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-primary">بررسی درخواستها</Link></div></section>

    {/* Visit stats */}
    <section>
      <div className="mb-3 flex items-center gap-2"><Eye size={18} className="text-secondary" /><h2 className="text-lg font-black text-primary">بازدید سایت</h2></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["امروز", summary.visitsToday, summary.visitorsToday],
          ["این هفته", summary.visitsWeek, summary.visitorsWeek],
          ["این ماه", summary.visitsMonth, summary.visitorsMonth],
          ["کل", summary.visitsTotal, summary.visitorsTotal],
        ].map(([label, views, visitors]) => (
          <div key={label} className="rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-secondary">{label}</p>
            <p className="mt-2 text-3xl font-black text-primary">{Number(views).toLocaleString("fa-IR")}</p>
            <p className="mt-1 text-[11px] text-outline">{Number(visitors).toLocaleString("fa-IR")} بازدیدکننده یکتا</p>
          </div>
        ))}
      </div>
    </section>

    {/* Key stats */}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, count, description, Icon, color]) => <article key={label} className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color}`}><Icon size={22} /></span><div><p className="text-2xl font-black text-primary">{count.toLocaleString("fa-IR")}</p><p className="text-sm font-bold text-primary">{label}</p></div></div><p className="mt-3 text-xs leading-5 text-outline">{description}</p></article>)}</section>

    {/* Trend chart with visits */}
    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7"><div className="flex items-center gap-2"><TrendingUp size={20} className="text-secondary" /><div><h2 className="font-black text-primary">روند ۳۰ روز اخیر</h2><p className="mt-1 text-xs text-outline">بازدید، کاربران جدید و درخواستهای ثبتنام</p></div></div><div className="mt-7 flex h-52 items-end gap-1">{report.trend.map((item) => <div key={item.date} className="group relative flex h-full flex-1 items-end gap-px" title={`${new Date(item.date).toLocaleDateString("fa-IR")}: ${item.visits} بازدید، ${item.users} کاربر، ${item.applications} درخواست`}><span className="w-1/3 rounded-t bg-blue-400/70 transition group-hover:bg-blue-500" style={{ height: `${Math.max(item.visits ? 4 : 0, item.visits / chartMax * 100)}%` }} /><span className="w-1/3 rounded-t bg-primary/80 transition group-hover:bg-primary" style={{ height: `${Math.max(item.users ? 4 : 0, item.users / chartMax * 100)}%` }} /><span className="w-1/3 rounded-t bg-secondary/80 transition group-hover:bg-secondary" style={{ height: `${Math.max(item.applications ? 4 : 0, item.applications / chartMax * 100)}%` }} /></div>)}</div><div className="mt-4 flex gap-5 text-xs text-outline"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-400" />بازدید</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-primary" />کاربران جدید</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-secondary" />درخواست دوره</span></div></div>
      <div className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7"><div className="flex items-center justify-between"><div><h2 className="font-black text-primary">آخرین درخواست‌ها</h2><p className="mt-1 text-xs text-outline">آخرین متقاضیان دوره</p></div><Link href="/admin/applications" className="text-xs font-bold text-secondary">مشاهده همه</Link></div><div className="mt-5 divide-y divide-outline-variant/20">{report.recentApplications.map((item) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-primary">{item.fullName}</p><p className="mt-1 truncate text-xs text-outline">{item.course.title}</p></div><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === "approved" ? "bg-green-50 text-green-700" : item.status === "rejected" ? "bg-error-container text-error" : "bg-[#fff4df] text-secondary"}`}>{statusLabel[item.status] || item.status}</span></div></div>)}{report.recentApplications.length === 0 && <p className="py-8 text-center text-sm text-outline">هنوز درخواستی ثبت نشده است.</p>}</div></div></section>

    {/* Top courses */}
    <section className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7">
      <div className="flex items-center gap-2 mb-5"><BarChart3 size={20} className="text-secondary" /><div><h2 className="font-black text-primary">محبوبترین دورهها</h2><p className="mt-1 text-xs text-outline">بر اساس تعداد دانشجوی ثبتنامشده</p></div></div>
      <div className="space-y-3">
        {report.topCourses.map((course, index) => (
          <div key={course.id} className="flex items-center gap-4">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${index === 0 ? "bg-secondary-fixed text-primary" : index === 1 ? "bg-surface-variant text-primary" : index === 2 ? "bg-surface-variant/70 text-primary" : "bg-surface-low text-outline"}`}>{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-bold text-primary">{course.title}</p>
                <p className="shrink-0 text-xs font-black text-secondary">{course.enrollments.toLocaleString("fa-IR")} دانشجو</p>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-surface-low overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-secondary to-secondary/60 transition-all duration-500" style={{ width: `${(course.enrollments / topCourseMax) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-primary">آخرین بروزرسانی‌ها</h2><p className="mt-1 text-xs text-outline">سامانه روی نسخه {APP_VERSION} است</p></div><Link href="/admin/updates" className="text-sm font-bold text-secondary">مشاهده همه</Link></div><div className="space-y-3">{releaseNotes.slice(0, 3).map((note) => <div key={note.id} className="flex items-start justify-between gap-4 rounded-xl bg-surface-low p-4"><div><p className="text-sm font-bold text-primary">{note.title}</p><p className="mt-1 text-xs text-outline">{note.summary}</p></div><time className="whitespace-nowrap text-[11px] text-outline">{new Date(note.publishedAt).toLocaleDateString("fa-IR")}</time></div>)}</div></section>
  </div>;
}
