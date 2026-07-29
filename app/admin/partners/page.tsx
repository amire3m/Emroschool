"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, X, Eye, EyeOff, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";

interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  order: number;
  showOnSite: boolean;
}

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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-primary" /></div>;
  if (error) return <div className="flex items-center justify-center h-64 text-error gap-2"><AlertCircle size={20} /><span>{error}</span></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-primary">مدیریت همراهان</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-container transition-colors">
          <Plus size={18} /> افزودن همراه
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline w-12">ردیف</th>
                <th className="text-right p-3 font-medium text-outline">نام</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">لوگو</th>
                <th className="text-center p-3 font-medium text-outline w-20">نمایش</th>
                <th className="text-left p-3 font-medium text-outline w-24">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p, i) => (
                <tr key={p.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50">
                  <td className="p-3 text-outline">{i + 1}</td>
                  <td className="p-3 font-medium text-primary">{p.name}</td>
                  <td className="p-3 hidden sm:table-cell">
                    <img src={p.logoUrl} alt={p.name} className="w-12 h-12 object-contain rounded-lg border border-surface-variant" />
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => toggleVisibility(p)} className={`p-1.5 rounded-lg transition-colors ${p.showOnSite ? "text-green-600 hover:bg-green-50" : "text-outline hover:bg-surface-variant"}`}>
                      {p.showOnSite ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="p-2 rounded-xl text-outline hover:text-primary hover:bg-surface-variant">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 rounded-xl text-outline hover:text-error hover:bg-error-container">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-outline">همراهی ثبت نشده است</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">{editing ? "ویرایش همراه" : "افزودن همراه جدید"}</h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-primary p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">نام موسسه / سازمان</label>
                <input type="text" required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-2">لوگو</label>
                <ImageUpload value={form.logoUrl} onChange={(url) => setForm(p => ({ ...p, logoUrl: url }))} label="آپلود لوگو" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.showOnSite} onChange={(e) => setForm(p => ({ ...p, showOnSite: e.target.checked }))}
                  className="w-4 h-4 rounded border-surface-variant text-primary focus:ring-secondary-fixed" />
                <span className="text-sm text-primary">نمایش در سایت</span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-container transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editing ? "بروزرسانی" : "ذخیره"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
