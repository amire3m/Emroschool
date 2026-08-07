"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Banknote, BookOpen, CheckCircle2, ClipboardList, CreditCard, GraduationCap, Loader2, TrendingUp, UserPlus, Users, XCircle } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import { APP_VERSION, releaseNotes } from "@/lib/version";

type Report = {
  summary: { usersTotal: number; usersToday: number; usersMonth: number; completedRegistrations: number; applicationsTotal: number; applicationsPending: number; applicationsApproved: number; applicationsRejected: number; enrollmentTotal: number; uniqueApplicants: number; paidOrders: number; paidAmountTomans: number; pendingPayments: number };
  trend: Array<{ date: string; users: number; applications: number }>;
  recentApplications: Array<{ id: string; fullName: string; status: string; createdAt: string; finalAmountTomans: number; course: { title: string } }>;
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
    ["کاربران کل", summary.usersTotal, `${summary.usersToday.toLocaleString("fa-IR")} کاربر امروز`, Users, "bg-[#eeecfc] text-primary"],
    ["ثبت‌نام تکمیل‌شده سایت", summary.completedRegistrations, `${summary.usersMonth.toLocaleString("fa-IR")} کاربر جدید این ماه`, UserPlus, "bg-[#e8f7ee] text-green-700"],
    ["درخواست‌های دوره", summary.applicationsTotal, `${summary.applicationsPending.toLocaleString("fa-IR")} مورد در انتظار`, ClipboardList, "bg-[#fff4df] text-secondary"],
    ["متقاضیان یکتا", summary.uniqueApplicants, "افرادی که برای خود دوره ثبت کرده‌اند", GraduationCap, "bg-[#e2e1f0] text-primary"],
    ["ثبت‌نام قطعی دوره", summary.enrollmentTotal, `${summary.applicationsApproved.toLocaleString("fa-IR")} درخواست تأییدشده`, CheckCircle2, "bg-[#e8f7ee] text-green-700"],
    ["پرداخت موفق", summary.paidOrders, `${summary.paidAmountTomans.toLocaleString("fa-IR")} تومان`, Banknote, "bg-[#eaf5ff] text-blue-700"],
    ["نیازمند پیگیری پرداخت", summary.pendingPayments, "رسید یا پرداخت در انتظار", CreditCard, "bg-[#fff4df] text-secondary"],
    ["درخواست ردشده", summary.applicationsRejected, "نیازمند بررسی مجدد در صورت درخواست", XCircle, "bg-error-container text-error"],
  ] as const;
  const chartMax = Math.max(1, ...report.trend.flatMap((item) => [item.users, item.applications]));

  return <div className="space-y-7" dir="rtl">
    <section className="rounded-[1.8rem] bg-primary p-6 text-white md:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-secondary-fixed">نمای کلی آکادمی</p><h1 className="mt-2 text-2xl font-black">گزارش مدیریت</h1><p className="mt-2 text-sm text-white/65">آمار کاربران، ثبت‌نام‌ها، دوره‌ها و پرداخت‌ها در یک نگاه.</p></div><Link href="/admin/applications" className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-primary">بررسی درخواست‌ها</Link></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, count, description, Icon, color]) => <article key={label} className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color}`}><Icon size={22} /></span><div><p className="text-2xl font-black text-primary">{count.toLocaleString("fa-IR")}</p><p className="text-sm font-bold text-primary">{label}</p></div></div><p className="mt-3 text-xs leading-5 text-outline">{description}</p></article>)}</section>
    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7"><div className="flex items-center gap-2"><TrendingUp size={20} className="text-secondary" /><div><h2 className="font-black text-primary">روند ۳۰ روز اخیر</h2><p className="mt-1 text-xs text-outline">کاربران جدید و درخواست‌های ثبت‌نام دوره</p></div></div><div className="mt-7 flex h-48 items-end gap-1.5">{report.trend.map((item, index) => <div key={item.date} className="group flex h-full flex-1 items-end gap-px" title={`${new Date(item.date).toLocaleDateString("fa-IR")}: ${item.users} کاربر، ${item.applications} درخواست`}><span className="w-1/2 rounded-t bg-primary/80 transition group-hover:bg-primary" style={{ height: `${Math.max(item.users ? 6 : 0, item.users / chartMax * 100)}%` }} /><span className="w-1/2 rounded-t bg-secondary/80 transition group-hover:bg-secondary" style={{ height: `${Math.max(item.applications ? 6 : 0, item.applications / chartMax * 100)}%` }} />{index % 7 === 0 && <small className="sr-only">{item.date}</small>}</div>)}</div><div className="mt-4 flex gap-5 text-xs text-outline"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-primary" />کاربران جدید</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-secondary" />درخواست دوره</span></div></div>
      <div className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-5 md:p-7"><div className="flex items-center justify-between"><div><h2 className="font-black text-primary">آخرین درخواست‌ها</h2><p className="mt-1 text-xs text-outline">آخرین متقاضیان دوره</p></div><Link href="/admin/applications" className="text-xs font-bold text-secondary">مشاهده همه</Link></div><div className="mt-5 divide-y divide-outline-variant/20">{report.recentApplications.map((item) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-primary">{item.fullName}</p><p className="mt-1 truncate text-xs text-outline">{item.course.title}</p></div><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === "approved" ? "bg-green-50 text-green-700" : item.status === "rejected" ? "bg-error-container text-error" : "bg-[#fff4df] text-secondary"}`}>{statusLabel[item.status] || item.status}</span></div></div>)}{report.recentApplications.length === 0 && <p className="py-8 text-center text-sm text-outline">هنوز درخواستی ثبت نشده است.</p>}</div></div></section>
    <section className="rounded-[1.8rem] border border-outline-variant/30 bg-white p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-primary">آخرین بروزرسانی‌ها</h2><p className="mt-1 text-xs text-outline">سامانه روی نسخه {APP_VERSION} است</p></div><Link href="/admin/updates" className="text-sm font-bold text-secondary">مشاهده همه</Link></div><div className="space-y-3">{releaseNotes.slice(0, 3).map((note) => <div key={note.id} className="flex items-start justify-between gap-4 rounded-xl bg-surface-low p-4"><div><p className="text-sm font-bold text-primary">{note.title}</p><p className="mt-1 text-xs text-outline">{note.summary}</p></div><time className="whitespace-nowrap text-[11px] text-outline">{new Date(note.publishedAt).toLocaleDateString("fa-IR")}</time></div>)}</div></section>
  </div>;
}
