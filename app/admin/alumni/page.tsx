"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  X,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";

interface AlumniItem {
  id: string;
  name: string;
  field: string;
  batch: string;
  quote: string;
  imageUrl: string | null;
  achievements: string | null;
  order: number;
  showOnSite: boolean;
  createdAt: string;
  userId: string | null;
  user?: { id: string; name: string } | null;
}

export default function AdminAlumni() {
  const [alumni, setAlumni] = useState<AlumniItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AlumniItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlumniItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const [form, setForm] = useState({
    name: "",
    field: "",
    batch: "",
    quote: "",
    imageUrl: "",
    achievements: "",
    showOnSite: true,
    userId: "",
  });

  const getToken = () => getCookie("token") || "";

  const fetchData = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/alumni", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/users", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([data, usersData]) => {
        setAlumni(data.alumni || []);
        setUsers(usersData.users || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setForm({ name: "", field: "", batch: "", quote: "", imageUrl: "", achievements: "", showOnSite: true, userId: "" });
    setEditingItem(null);
  };

  const openCreateModal = () => { resetForm(); setShowModal(true); };

  const openEditModal = (item: AlumniItem) => {
    setForm({
      name: item.name,
      field: item.field,
      batch: item.batch,
      quote: item.quote,
      imageUrl: item.imageUrl || "",
      achievements: item.achievements || "",
      showOnSite: item.showOnSite,
      userId: item.userId || "",
    });
    setEditingItem(item);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error("نام الزامی است"); return; }
    setSaving(true);
    const token = getToken();

    const body = {
      name: form.name,
      field: form.field,
      batch: form.batch,
      quote: form.quote,
      imageUrl: form.imageUrl || null,
      achievements: form.achievements || null,
      showOnSite: form.showOnSite,
      userId: form.userId || null,
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/alumni/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "خطا"); }
        toast.success("هنرآموخته بروزرسانی شد");
      } else {
        const res = await fetch("/api/alumni", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "خطا"); }
        toast.success("هنرآموخته ایجاد شد");
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const token = getToken();
    try {
      const res = await fetch(`/api/alumni/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "خطا"); }
      toast.success("هنرآموخته حذف شد");
      setDeleteTarget(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally { setSaving(false); }
  };

  const moveOrder = async (id: string, direction: "up" | "down") => {
    const idx = alumni.findIndex((s) => s.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === alumni.length - 1) return;

    const newList = [...alumni];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];

    const token = getToken();
    try {
      await Promise.all([
        fetch(`/api/alumni/${newList[idx].id}`, { method: "PUT", headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ order: idx + 1 }) }),
        fetch(`/api/alumni/${newList[swapIdx].id}`, { method: "PUT", headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ order: swapIdx + 1 }) }),
      ]);
      fetchData();
    } catch { toast.error("خطا در تغییر ترتیب"); }
  };

  const sorted = [...alumni].sort((a, b) => a.order - b.order);
  const filtered = sorted.filter((a) => a.name.includes(search) || a.field.includes(search));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#03004b]" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-error gap-2"><AlertCircle size={20} /><span>خطا: {error}</span></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="جستجوی هنرآموخته..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] focus:border-[#03004b]" />
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#03004b] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors">
          <Plus size={18} />
          افزودن هنرآموخته
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">نام</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">رشته</th>
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">دوره</th>
                <th className="text-center p-3 font-medium text-outline">ترتیب</th>
                <th className="text-center p-3 font-medium text-outline">نمایش</th>
                <th className="text-left p-3 font-medium text-outline">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr key={item.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#eeecfc] flex items-center justify-center overflow-hidden shrink-0">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[#03004b] font-bold text-sm">{item.name.charAt(0)}</span>}
                      </div>
                      <div className="font-medium text-primary">{item.name}</div>
                    </div>
                  </td>
                  <td className="p-3 text-outline hidden sm:table-cell">{item.field}</td>
                  <td className="p-3 text-outline hidden md:table-cell">{item.batch}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-outline text-xs ml-1">{item.order}</span>
                      <button onClick={() => moveOrder(item.id, "up")} disabled={index === 0}
                        className="p-0.5 rounded text-outline hover:text-[#03004b] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                      <button onClick={() => moveOrder(item.id, "down")} disabled={index === filtered.length - 1}
                        className="p-0.5 rounded text-outline hover:text-[#03004b] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {item.showOnSite ? (
                      <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-lg text-xs"><Eye size={12} />فعال</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-outline bg-surface-low px-2 py-0.5 rounded-lg text-xs"><EyeOff size={12} />مخفی</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEditModal(item)}
                        className="p-2 rounded-xl text-outline hover:text-[#03004b] hover:bg-[#eeecfc] transition-colors" title="ویرایش"><Pencil size={16} /></button>
                      <button onClick={() => setDeleteTarget(item)}
                        className="p-2 rounded-xl text-outline hover:text-error hover:bg-error-container transition-colors" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-outline">هنرآموخته‌ای یافت نشد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">{editingItem ? "ویرایش هنرآموخته" : "افزودن هنرآموخته جدید"}</h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-primary p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">اتصال به حساب کاربری (اختیاری)</label>
                <select
                  value={form.userId}
                  onChange={(e) => {
                    const selected = users.find((user) => user.id === e.target.value);
                    setForm((previous) => ({ ...previous, userId: e.target.value, name: previous.name || selected?.name || "" }));
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed"
                >
                  <option value="">بدون حساب کاربری</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">نام *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">رشته</label>
                  <input type="text" value={form.field} onChange={(e) => setForm((p) => ({ ...p, field: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">دوره</label>
                  <input type="text" value={form.batch} onChange={(e) => setForm((p) => ({ ...p, batch: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]" />
                </div>
              </div>
              <ImageUpload value={form.imageUrl} onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))} label="تصویر" sizeHint="۳۰۰ × ۳۰۰ پیکسل" aspectRatio="1:1" />
              <div>
                <label className="block text-sm font-medium text-primary mb-1">نقل قول</label>
                <textarea rows={2} value={form.quote} onChange={(e) => setForm((p) => ({ ...p, quote: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">افتخارات (با کاما جدا کنید)</label>
                <textarea rows={2} value={form.achievements} onChange={(e) => setForm((p) => ({ ...p, achievements: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-variant">
                <div>
                  <label className="text-sm font-medium text-primary">نمایش در سایت</label>
                  <p className="text-xs text-outline mt-0.5">در صورت غیرفعال بودن، در سایت نمایش داده نمی‌شود</p>
                </div>
                <button type="button" onClick={() => setForm((p) => ({ ...p, showOnSite: !p.showOnSite }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.showOnSite ? "bg-green-500" : "bg-surface-variant"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.showOnSite ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingItem ? "بروزرسانی" : "ایجاد"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !saving && setDeleteTarget(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4"><Trash2 size={28} className="text-error" /></div>
              <h3 className="text-lg font-bold text-primary mb-2">حذف هنرآموخته</h3>
              <p className="text-outline text-sm mb-1">آیا از حذف <span className="font-bold text-primary">"{deleteTarget.name}"</span> اطمینان دارید؟</p>
              <p className="text-outline text-xs">این عمل قابل بازگشت نیست.</p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={handleDelete} disabled={saving}
                  className="flex items-center gap-2 bg-error text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}حذف</button>
                <button onClick={() => setDeleteTarget(null)} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
