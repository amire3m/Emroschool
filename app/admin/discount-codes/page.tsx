"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
} from "@/components/admin/ui";

type Discount = { id: string; label: string; code: string; percent: number; active: boolean; requiresDocument: boolean };
const empty = { label: "", code: "", percent: 0, active: true, requiresDocument: false };

const INPUT_CLASS = "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
const ICON_BUTTON = "rounded-lg border p-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function DiscountCodesPage() {
  const [items, setItems] = useState<Discount[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null); const [loading, setLoading] = useState(true); const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getCookie("token")}` });
  async function load() { const response = await fetch("/api/admin/discount-codes", { headers: headers() }); const data = await response.json(); if (!response.ok) { toast.error(data.error || "دریافت کدها ناموفق بود"); return; } setItems(data.discountCodes || []); setLoading(false); }
  useEffect(() => { load(); }, []);
  function reset() { setForm(empty); setEditing(null); }
  async function save() { try { const response = await fetch("/api/admin/discount-codes", { method: editing ? "PATCH" : "POST", headers: headers(), body: JSON.stringify(editing ? { ...form, id: editing } : form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success(editing ? "کد بروزرسانی شد" : "کد جدید افزوده شد"); reset(); load(); } catch (error) { toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود"); } }
  async function remove(id: string) { if (!confirm("این کد حذف شود؟")) return; const response = await fetch("/api/admin/discount-codes", { method: "DELETE", headers: headers(), body: JSON.stringify({ id }) }); if (!response.ok) { const data = await response.json(); toast.error(data.error); return; } toast.success("کد حذف شد"); load(); }
  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[#03004b]" /></div>;
  return (
    <div className="space-y-5">
      <PageHeader title="مدیریت کدهای تخفیف" subtitle="کاربر فقط نام گروه را می‌بیند؛ کد و درصد برای او نمایش داده نمی‌شود." />
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-900">{editing ? "ویرایش کد" : "افزودن کد تخفیف"}</h2>
          {editing && <SecondaryButton onClick={reset} className="px-3 py-1.5 text-xs">انصراف</SecondaryButton>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-900">نام گروه<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={INPUT_CLASS} /></label>
          <label className="block text-sm font-bold text-slate-900">کد تخفیف<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" className={INPUT_CLASS} /></label>
          <label className="block text-sm font-bold text-slate-900">درصد تخفیف<input value={form.percent} onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })} min="0" max="100" type="number" className={`${INPUT_CLASS} tabular-nums`} /></label>
          <div className="flex flex-wrap items-end gap-5 pb-3 text-sm font-bold text-slate-900">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#03004b]" />فعال</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.requiresDocument} onChange={(e) => setForm({ ...form, requiresDocument: e.target.checked })} className="h-4 w-4 accent-[#03004b]" />نیازمند مدرک</label>
          </div>
        </div>
        <PrimaryButton onClick={save} className="mt-5">{editing ? <Save size={16} /> : <Plus size={16} />}{editing ? "ذخیره تغییرات" : "افزودن کد"}</PrimaryButton>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-black text-slate-900">کدهای فعال و غیرفعال</h2>
        <DataTable
          head={
            <>
              <Th>نام گروه</Th>
              <Th>کد تخفیف</Th>
              <Th>درصد تخفیف</Th>
              <Th>وضعیت</Th>
              <Th>مدرک الزامی</Th>
              <Th>عملیات</Th>
            </>
          }
        >
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100 transition first:border-t-0 hover:bg-slate-50/60">
              <Td className="font-bold text-slate-900">{item.label}</Td>
              <Td><span dir="ltr" className="text-xs tabular-nums text-slate-500">{item.code}</span></Td>
              <Td className="tabular-nums text-slate-900">{item.percent.toLocaleString("fa-IR")}٪</Td>
              <Td><Badge tone={item.active ? "emerald" : "slate"}>{item.active ? "فعال" : "غیرفعال"}</Badge></Td>
              <Td>{item.requiresDocument ? <span className="text-xs text-slate-500">مدرک الزامی</span> : <span className="text-xs text-slate-400">—</span>}</Td>
              <Td>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditing(item.id); setForm({ label: item.label, code: item.code, percent: item.percent, active: item.active, requiresDocument: item.requiresDocument }); }} className={`${ICON_BUTTON} border-slate-200 text-slate-600 hover:bg-slate-50`}><Pencil size={16} /></button>
                  <button type="button" onClick={() => remove(item.id)} className={`${ICON_BUTTON} border-red-200/70 text-red-600 hover:bg-red-50`}><Trash2 size={16} /></button>
                </div>
              </Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td colSpan={6}><EmptyState message="کدی ثبت نشده است." /></Td></tr>
          )}
        </DataTable>
      </section>
    </div>
  );
}
