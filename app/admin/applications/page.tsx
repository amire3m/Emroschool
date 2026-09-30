"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, Eye, FileCog, Loader2, Search } from "lucide-react";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import Link from "next/link";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ExportActions from "@/components/admin/export-actions";
import {
  Badge,
  DangerButton,
  DataTable,
  EmptyState,
  FilterChips,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchInput,
  SecondaryButton,
  Td,
  Th,
  type BadgeTone,
} from "@/components/admin/ui";

interface Application {
  id: string; status: string; fullName: string; email: string; phone: string; nationalCode: string | null; province: string; city: string; address: string; postalCode: string;
  workHistory: string | null; artHistory: string | null; educationLevel: string; educationField: string; reason: string; knowsInstructors: boolean;
  familiarityDetails: string | null; instagramId: string | null; virtualPhone: string; landline: string | null; customResponses?: string | null; formSchema?: string | null; createdAt: string;
  birthDate?: string | null; gender?: string | null;
  discountCode?: string | null; discountLabel?: string | null; discountPercent?: number; finalAmountTomans?: number; discountDocumentUrl?: string | null;
  course: { id: string; title: string; slug: string; startDate: string | null }; user: { id: string; name: string; email: string; phone: string | null; avatar?: string | null };
}
const statusLabels: Record<string, string> = { pending: "در انتظار بررسی", pending_payment: "در انتظار بررسی", approved: "تأیید شده", rejected: "رد شده" };

function statusTone(status: string): BadgeTone {
  return status === "approved" ? "emerald" : status === "rejected" ? "red" : "amber";
}

function formatBirthDate(value?: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new DateObject({ date: d, calendar: persian, locale: persianFa }).format("YYYY/MM/DD");
  } catch {
    return value;
  }
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [saving, setSaving] = useState(false);
  const token = () => getCookie("token") || "";
  async function load() { setLoading(true); try { const response = await fetch("/api/course-applications?admin=1", { headers: { authorization: `Bearer ${token()}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setApplications(data.applications || []); } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در دریافت درخواست‌ها"); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function changeStatus(status: string) { if (!selected) return; setSaving(true); try { const response = await fetch(`/api/course-applications/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", authorization: `Bearer ${token()}` }, body: JSON.stringify({ status }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success(status === "approved" ? "درخواست تأیید و کاربر در دوره ثبت شد" : "وضعیت درخواست بروزرسانی شد"); setSelected(null); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در بروزرسانی"); } finally { setSaving(false); } }
  const courseOptions = Array.from(new Map(applications.map((item) => [item.course.id, item.course.title])).values()).sort((a, b) => a.localeCompare(b));
  const visible = applications.filter((item) => (filter === "all" || (filter === "pending" ? ["pending", "pending_payment"].includes(item.status) : item.status === filter)) && (courseFilter === "all" || item.course.id === courseFilter) && (item.fullName.includes(search) || item.email.includes(search) || item.phone.includes(search) || item.course.title.includes(search)));
  const grouped = Array.from(new Map(visible.map((item) => [item.course.id, item.course.title])).entries());
  const fields = selected ? [["نام و نام خانوادگی", selected.fullName], ["تاریخ تولد", formatBirthDate(selected.birthDate)], ["جنسیت", selected.gender === "male" ? "آقا" : selected.gender === "female" ? "خانم" : "—"], ["کد ملی", selected.nationalCode || "—"], ["تخفیف", selected.discountLabel ? `${selected.discountLabel} (${selected.discountPercent}٪) — مبلغ نهایی: ${(selected.finalAmountTomans || 0).toLocaleString("fa-IR")} تومان` : "بدون تخفیف"], ["ایمیل", selected.email], ["موبایل", selected.phone], ["استان و شهر", `${selected.province}، ${selected.city}`], ["آدرس", selected.address], ["کد پستی", selected.postalCode], ["مقطع و رشته", `${selected.educationLevel}، ${selected.educationField}`], ["شماره فضای مجازی", selected.virtualPhone], ["تلفن ثابت", selected.landline || "—"], ["اینستاگرام", selected.instagramId || "—"], ["سوابق کاری", selected.workHistory || "—"], ["سوابق هنری", selected.artHistory || "—"], ["دلیل انتخاب دوره", selected.reason], ["آشنایی قبلی با اساتید", selected.knowsInstructors ? `بله؛ ${selected.familiarityDetails}` : "خیر"], ...(() => { try { const responses = JSON.parse(selected.customResponses || "{}"); const schema = JSON.parse(selected.formSchema || "{}"); return (schema.steps || []).flatMap((step: { fields?: Array<{ key: string; label: string; system?: boolean }> }) => (step.fields || []).filter((field) => !field.system && responses[field.key]).map((field) => [field.label, responses[field.key]])); } catch { return []; } })()] : [];
  return <div className="space-y-5" dir="rtl">
    <PageHeader
      title="درخواست‌های ثبت‌نام"
      actions={<><Link href="/admin/applications/form" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FileCog size={16} />فرم ثبت‌نام</Link><ExportActions endpoint="/api/admin/exports/applications" title="گزارش درخواست‌های ثبت‌نام" fileName="گزارش-درخواست‌های-ثبت‌نام" /></>}
    />
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative md:w-72">
        <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="نام، ایمیل، موبایل یا دوره..." />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15"><option value="all">همه دوره‌ها</option>{courseOptions.map((title) => <option key={title} value={applications.find((item) => item.course.title === title)!.course.id}>{title}</option>)}</select>
        <FilterChips value={filter} onChange={setFilter} options={[{ value: "all", label: "همه" }, { value: "pending", label: "در انتظار" }, { value: "approved", label: "تأییدشده" }, { value: "rejected", label: "ردشده" }]} />
      </div>
    </div>
    {loading ? <div className="h-64 flex justify-center items-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div> : visible.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="درخواستی پیدا نشد" /></div> : (
      <DataTable
        head={<><Th>متقاضی</Th><Th>دوره</Th><Th>تاریخ</Th><Th center>وضعیت</Th><Th><span className="sr-only">عملیات</span></Th></>}
      >
        {grouped.map(([courseId, courseTitle]) => {
          const rows = visible.filter((item) => item.course.id === courseId);
          return (
            <Fragment key={courseId}>
              <tr className="bg-slate-50">
                <Td className="px-3 py-2 text-xs font-black text-slate-900" colSpan={5}>{courseTitle}<span className="mr-2 font-bold text-slate-500">({rows.length} نفر)</span></Td>
              </tr>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                  <Td><p className="font-bold text-slate-900">{item.fullName}</p><p className="mt-1 text-xs tabular-nums text-slate-500" dir="ltr">{item.phone}</p></Td>
                  <Td className="text-slate-600">{item.course.title}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</Td>
                  <Td className="text-center"><Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge></Td>
                  <Td><button onClick={() => setSelected(item)} aria-label={`مشاهده ${item.fullName}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"><Eye size={17} /></button></Td>
                </tr>
              ))}
            </Fragment>
          );
        })}
      </DataTable>
    )}
    {selected && (
      <Modal title={selected.course.title} subtitle="درخواست ثبت‌نام" onClose={() => !saving && setSelected(null)} maxWidth="max-w-3xl"
        footer={<><PrimaryButton onClick={() => changeStatus("approved")} disabled={saving} ><Check size={16} />تأیید و ثبت در دوره</PrimaryButton><DangerButton onClick={() => changeStatus("rejected")} disabled={saving}>رد درخواست</DangerButton>{selected.status !== "pending" && <SecondaryButton onClick={() => changeStatus("pending")} disabled={saving}>بازگشت به انتظار</SecondaryButton>}</>}
      >
        {selected.user.avatar ? <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-[11px] font-bold text-slate-500">تصویر پرسنلی</span><img src={selected.user.avatar} alt="تصویر پرسنلی" className="h-20 w-20 rounded-xl object-cover" /></div> : null}
        <div className="grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${["آدرس", "سوابق کاری", "سوابق هنری", "دلیل انتخاب دوره", "آشنایی قبلی با اساتید"].includes(label) ? "sm:col-span-2" : ""}`}><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold leading-7 text-slate-900 whitespace-pre-line">{value}</p></div>)}</div>
      </Modal>
    )}
  </div>;
}
