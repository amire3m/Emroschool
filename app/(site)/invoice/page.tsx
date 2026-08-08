"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2, ShieldCheck } from "lucide-react";
import { getCookie } from "@/lib/cookie";

type Application = {
  id: string; fullName: string; email: string; phone: string; nationalCode?: string | null;
  address: string; discountLabel?: string | null; discountPercent: number; finalAmountTomans: number;
  createdAt: string; course: { title: string; price: number; slug: string };
};

const money = (amount: number) => amount.toLocaleString("fa-IR");
const date = () => new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date());

export default function InvoicePage() {
  const router = useRouter();
  const applicationId = useSearchParams().get("application");
  const [application, setApplication] = useState<Application | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(`/invoice?application=${applicationId || ""}`)}`);
      return;
    }
    if (!applicationId) { setError("شناسه درخواست ثبت‌نام مشخص نشده است."); return; }
    fetch(`/api/course-applications/${applicationId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "دریافت فاکتور ناموفق بود");
        setApplication(data.application);
      })
      .catch((reason) => setError(reason.message || "دریافت فاکتور ناموفق بود"));
  }, [applicationId, router]);

  if (error) return <main dir="rtl" className="min-h-screen bg-surface px-5 pb-20 pt-32"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center text-outline shadow-sm">{error}</div></main>;
  if (!application) return <main className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-primary" /></main>;

  const discount = Math.max(0, application.course.price - application.finalAmountTomans);
  return <main dir="rtl" className="min-h-screen bg-surface px-4 pb-20 pt-28 md:px-6">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-outline-variant/40 bg-white shadow-lg">
      <header className="bg-primary px-6 py-7 text-white md:px-9">
        <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-fixed text-primary"><FileText /></span><div><p className="text-xs font-bold text-secondary-fixed">آکادمی هنر و رسانه امام روح‌الله</p><h1 className="mt-1 text-2xl font-black">صورتحساب ثبت‌نام دوره</h1></div></div><ShieldCheck className="text-secondary-fixed" /></div>
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-xs text-white/75"><p>شماره فاکتور: <b dir="ltr" className="text-white">{application.id.slice(-8).toUpperCase()}</b></p><p className="text-left">تاریخ صدور: <b className="text-white">{date()}</b></p></div>
      </header>
      <div className="space-y-7 p-6 md:p-9">
        <section><h2 className="mb-3 border-b border-outline-variant/30 pb-2 text-sm font-black text-primary">اطلاعات خریدار</h2><div className="grid gap-2 text-sm text-outline sm:grid-cols-2"><p><b className="text-primary">نام و نام خانوادگی:</b> {application.fullName}</p><p><b className="text-primary">شماره همراه:</b> <span dir="ltr">{application.phone}</span></p><p><b className="text-primary">ایمیل:</b> <span dir="ltr">{application.email}</span></p><p><b className="text-primary">کد ملی:</b> <span dir="ltr">{application.nationalCode || "-"}</span></p></div></section>
        <section><h2 className="mb-3 border-b border-outline-variant/30 pb-2 text-sm font-black text-primary">اقلام صورتحساب</h2><div className="overflow-hidden rounded-2xl border border-outline-variant/30"><div className="grid grid-cols-[1fr_auto] gap-4 bg-surface-low px-4 py-3 text-xs font-bold text-outline"><span>شرح</span><span>مبلغ (تومان)</span></div><div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4 text-sm"><span className="font-bold text-primary">ثبت‌نام دوره {application.course.title}</span><span>{money(application.course.price)}</span></div>{application.discountPercent > 0 && <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-outline-variant/20 px-4 py-4 text-sm"><span><b className="text-primary">تخفیف {application.discountLabel || "ثبت‌نام"}</b> <span className="text-outline">({money(application.discountPercent)}٪)</span></span><span className="text-green-700">-{money(discount)}</span></div>}</div></section>
        <section className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-white/65">مبلغ نهایی قابل پرداخت</p><p className="mt-1 text-2xl font-black">{money(application.finalAmountTomans)} <span className="text-sm font-normal">تومان</span></p></div><button onClick={() => router.push(`/checkout?application=${application.id}`)} className="flex items-center justify-center gap-2 rounded-xl bg-secondary-fixed px-5 py-3 text-sm font-black text-primary">ورود به پرداخت <ArrowLeft size={17} /></button></section>
      </div>
    </article>
  </main>;
}
