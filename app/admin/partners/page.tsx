"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import { PageHeader, DataTable, Th, Td, EmptyState, PrimaryButton, SecondaryButton, Modal } from "@/components/admin/ui";

interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  order: number;
  showOnSite: boolean;
}

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "rounded-lg p-2 text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnDangerCls = "rounded-lg p-2 text-slate-400 transition hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", logoUrl: "", showOnSite: true });

  const getToken = () => getCookie("token") || "";

  const fetchPartners = () => {
    fetch("/api/partners")
      .then((r) => r.json())
      .then((data) => {
        if (data.partners) setPartners(data.partners);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchPartners(); }, []);

  const openCreate = () => {
    setForm({ name: "", logoUrl: "", showOnSite: true });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (p: Partner) => {
    setForm({ name: p.name, logoUrl: p.logoUrl, showOnSite: p.showOnSite });
    setEditing(p);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.logoUrl) { toast.error("نام و لوگو الزامی است"); return; }
    setSaving(true);
    const token = getToken();
    const body = { ...form, order: editing ? editing.order : partners.length };

    try {
      if (editing) {
        const res = await fetch(`/api/partners/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("بروزرسانی شد");
      } else {
        const res = await fetch("/api/partners", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("همراه اضافه شد");
      }
      setShowModal(false);
      fetchPartners();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف شود؟")) return;
    const token = getToken();
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("حذف شد");
      fetchPartners();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleVisibility = async (partner: Partner) => {
    const token = getToken();
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ showOnSite: !partner.showOnSite }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchPartners();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#03004b]" /></div>;
  if (error) return <div className="flex items-center justify-center h-64 text-red-600 gap-2"><AlertCircle size={20} /><span>{error}</span></div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت همراهان"
        actions={
          <PrimaryButton onClick={openCreate}>
            <Plus size={18} /> افزودن همراه
          </PrimaryButton>
        }
      />

      <DataTable
        head={
          <>
            <Th className="w-12">ردیف</Th>
            <Th>نام</Th>
            <Th className="hidden sm:table-cell">لوگو</Th>
            <Th center className="w-20">نمایش</Th>
            <Th className="w-24"><span className="flex justify-end">عملیات</span></Th>
          </>
        }
      >
        {partners.map((p, i) => (
          <tr key={p.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
            <Td className="tabular-nums text-slate-500">{i + 1}</Td>
            <Td className="font-bold text-slate-900">{p.name}</Td>
            <Td className="hidden sm:table-cell">
              <img src={p.logoUrl} alt={p.name} className="h-12 w-12 rounded-lg border border-slate-200 object-contain" />
            </Td>
            <Td className="text-center">
              <button
                type="button"
                onClick={() => toggleVisibility(p)}
                className="rounded-lg p-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] aria-[pressed=true]:text-emerald-600"
                aria-pressed={p.showOnSite}
                aria-label={p.showOnSite ? "نمایش داده می‌شود" : "نمایش داده نمی‌شود"}
              >
                {p.showOnSite ? <Eye size={18} className="text-emerald-600" /> : <EyeOff size={18} className="text-slate-400" />}
              </button>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button type="button" onClick={() => openEdit(p)} className={iconBtnCls} aria-label="ویرایش">
                  <Pencil size={16} />
                </button>
                <button type="button" onClick={() => handleDelete(p.id)} className={iconBtnDangerCls} aria-label="حذف">
                  <Trash2 size={16} />
                </button>
              </div>
            </Td>
          </tr>
        ))}
        {partners.length === 0 && (
          <tr className="border-t border-slate-100"><Td colSpan={5}><EmptyState message="همراهی ثبت نشده است" /></Td></tr>
        )}
      </DataTable>

      {showModal && (
        <Modal title={editing ? "ویرایش همراه" : "افزودن همراه جدید"} onClose={() => !saving && setShowModal(false)} maxWidth="max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-900">نام موسسه / سازمان</label>
              <input type="text" required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">لوگو</label>
              <ImageUpload value={form.logoUrl} onChange={(url) => setForm(p => ({ ...p, logoUrl: url }))} label="آپلود لوگو" sizeHint="۶۰۰ × ۴۰۰ پیکسل" aspectRatio="3:2" />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.showOnSite} onChange={(e) => setForm(p => ({ ...p, showOnSite: e.target.checked }))}
                className="h-4 w-4 rounded accent-[#03004b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]" />
              <span className="text-sm text-slate-900">نمایش در سایت</span>
            </label>
            <div className="flex items-center gap-3 pt-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editing ? "بروزرسانی" : "ذخیره"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowModal(false)} disabled={saving}>انصراف</SecondaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
