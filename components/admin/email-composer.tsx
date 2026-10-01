"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import { PageHeader, PrimaryButton } from "@/components/admin/ui";

export default function EmailComposer() {
  const [form, setForm] = useState({ to: "", senderName: "آکادمی هنر و رسانه امام روح‌الله", senderUsername: "academy", subject: "", message: "" });
  const [loading, setLoading] = useState(false); const [result, setResult] = useState(""); const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); setResult(""); try { const response = await fetch("/api/admin/email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCookie("token") || ""}` }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "ارسال ایمیل انجام نشد"); setResult(data.message); setForm((current) => ({ ...current, to: "", subject: "", message: "" })); } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "ارسال ایمیل انجام نشد"); } finally { setLoading(false); } }
  const inputClass = "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <p className="mb-1 text-xs font-bold text-slate-500">ارتباط مستقیم</p>
        <PageHeader title="ارسال ایمیل از دامنه آکادمی" subtitle="پیام را بنویسید؛ سامانه آن را در قالب گرافیکی رسمی آکادمی برای گیرنده ارسال می‌کند." />
      </div>
      {result && <div className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={18} />{result}</div>}{error && <div className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_.85fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Mail size={20} /></span>
            <div>
              <h2 className="text-base font-black text-slate-900">جزئیات پیام</h2>
              <p className="mt-1 text-xs text-slate-500">گیرنده و محتوای ایمیل</p>
            </div>
          </div>
          <label className="block text-sm font-bold text-slate-900">نشانی گیرنده<input required type="email" value={form.to} onChange={(e) => update("to", e.target.value)} className={inputClass} placeholder="recipient@example.com" dir="ltr" /></label>
          <label className="mt-4 block text-sm font-bold text-slate-900">عنوان پیام<input required value={form.subject} onChange={(e) => update("subject", e.target.value)} className={inputClass} placeholder="عنوان ایمیل" /></label>
          <label className="mt-4 block text-sm font-bold text-slate-900">متن پیام<textarea required rows={9} value={form.message} onChange={(e) => update("message", e.target.value)} className={`${inputClass} resize-y`} placeholder="متن پیام خود را بنویسید..." /></label>
          <PrimaryButton type="submit" disabled={loading} className="mt-5 w-full">{loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}ارسال پیام</PrimaryButton>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold text-slate-500">ارسال‌کننده</p>
          <h2 className="mt-1 text-base font-black text-slate-900">هویت ارسال‌کننده</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">نام نمایشی و نام کاربری دامنه را انتخاب کنید. ایمیل با نشانی زیر ارسال خواهد شد:</p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center font-mono text-sm tabular-nums text-slate-700" dir="ltr">{form.senderUsername || "academy"}@imamruhollahschool.com</div>
          <label className="mt-4 block text-sm font-bold text-slate-900">نام نمایشی<input required value={form.senderName} onChange={(e) => update("senderName", e.target.value)} className={inputClass} /></label>
          <label className="mt-4 block text-sm font-bold text-slate-900">نام کاربری دامنه<input required value={form.senderUsername} onChange={(e) => update("senderUsername", e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} className={`${inputClass} font-mono tabular-nums`} dir="ltr" placeholder="academy" /></label>
        </div>
      </form>
    </div>
  );
}
