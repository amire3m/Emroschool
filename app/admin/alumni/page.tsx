"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  SearchInput,
  Modal,
} from "@/components/admin/ui";

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

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

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
    return <div className="flex items-center justify-center h-64 text-red-600 gap-2"><AlertCircle size={20} /><span>خطا: {error}</span></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت هنرآموختگان"
        subtitle={`${alumni.length.toLocaleString("fa-IR")} هنرآموخته ثبت‌شده`}
        actions={
          <PrimaryButton onClick={openCreateModal}>
            <Plus size={15} />افزودن هنرآموخته
          </PrimaryButton>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <SearchInput type="text" placeholder="جستجوی هنرآموخته..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <DataTable
        minWidth={760}
        head={
          <>
            <Th>نام</Th>
            <Th className="hidden sm:table-cell">رشته</Th>
            <Th className="hidden md:table-cell">دوره</Th>
            <Th center>ترتیب</Th>
            <Th center>نمایش</Th>
            <Th>عملیات</Th>
          </>
        }
      >
        {filtered.map((item, index) => (
          <tr key={item.id} className="border-t border-slate-100 transition first:border-t-0 hover:bg-slate-50/60">
            <Td>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-slate-600">{item.name.charAt(0)}</span>}
                </div>
                <div className="font-medium text-slate-900">{item.name}</div>
              </div>
            </Td>
            <Td className="hidden text-slate-500 sm:table-cell">{item.field}</Td>
            <Td className="hidden text-slate-500 md:table-cell">{item.batch}</Td>
            <Td className="text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="ml-1 text-xs tabular-nums text-slate-500">{item.order}</span>
                <button type="button" onClick={() => moveOrder(item.id, "up")} disabled={index === 0}
                  className={`rounded p-0.5 text-slate-400 transition hover:text-[#03004b] disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_VISIBLE}`}><ChevronUp size={14} /></button>
                <button type="button" onClick={() => moveOrder(item.id, "down")} disabled={index === filtered.length - 1}
                  className={`rounded p-0.5 text-slate-400 transition hover:text-[#03004b] disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_VISIBLE}`}><ChevronDown size={14} /></button>
              </div>
            </Td>
            <Td className="text-center">
              {item.showOnSite ? (
                <Badge tone="emerald"><Eye size={12} />فعال</Badge>
              ) : (
                <Badge tone="slate"><EyeOff size={12} />مخفی</Badge>
              )}
            </Td>
            <Td>
              <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={() => openEditModal(item)}
                  className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="ویرایش"><Pencil size={16} /></button>
                <button type="button" onClick={() => setDeleteTarget(item)}
                  className={`rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 ${FOCUS_VISIBLE}`} title="حذف"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr><Td colSpan={6}><EmptyState message="هنرآموخته‌ای یافت نشد" /></Td></tr>
        )}
      </DataTable>

      {showModal && (
        <Modal
          title={editingItem ? "ویرایش هنرآموخته" : "افزودن هنرآموخته جدید"}
          onClose={() => { if (!saving) setShowModal(false); }}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">اتصال به حساب کاربری (اختیاری)</label>
              <select
                value={form.userId}
                onChange={(e) => {
                  const selected = users.find((user) => user.id === e.target.value);
                  setForm((previous) => ({ ...previous, userId: e.target.value, name: previous.name || selected?.name || "" }));
                }}
                className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}
              >
                <option value="">بدون حساب کاربری</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">نام *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">رشته</label>
                <input type="text" value={form.field} onChange={(e) => setForm((p) => ({ ...p, field: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">دوره</label>
                <input type="text" value={form.batch} onChange={(e) => setForm((p) => ({ ...p, batch: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`} />
              </div>
            </div>
            <ImageUpload value={form.imageUrl} onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))} label="تصویر" sizeHint="۳۰۰ × ۳۰۰ پیکسل" aspectRatio="1:1" />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">نقل قول</label>
              <textarea rows={2} value={form.quote} onChange={(e) => setForm((p) => ({ ...p, quote: e.target.value }))}
                className={`w-full resize-none ${INPUT_CLASS}`} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">افتخارات (با کاما جدا کنید)</label>
              <textarea rows={2} value={form.achievements} onChange={(e) => setForm((p) => ({ ...p, achievements: e.target.value }))}
                className={`w-full resize-none ${INPUT_CLASS}`} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <label className="text-sm font-medium text-slate-900">نمایش در سایت</label>
                <p className="mt-0.5 text-xs text-slate-500">در صورت غیرفعال بودن، در سایت نمایش داده نمی‌شود</p>
              </div>
              <button type="button" onClick={() => setForm((p) => ({ ...p, showOnSite: !p.showOnSite }))}
                className={`relative h-6 w-12 rounded-full transition-colors ${FOCUS_VISIBLE} ${form.showOnSite ? "bg-emerald-500" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.showOnSite ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingItem ? "بروزرسانی" : "ایجاد"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowModal(false)} disabled={saving}>انصراف</SecondaryButton>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="حذف هنرآموخته"
          onClose={() => { if (!saving) setDeleteTarget(null); }}
          maxWidth="max-w-md"
          footer={
            <>
              <DangerButton onClick={handleDelete} disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}حذف</DangerButton>
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>انصراف</SecondaryButton>
            </>
          }
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50"><Trash2 size={28} className="text-red-500" /></div>
            <p className="text-sm text-slate-500">آیا از حذف <span className="font-bold text-slate-900">"{deleteTarget.name}"</span> اطمینان دارید؟</p>
            <p className="mt-1 text-xs text-slate-500">این عمل قابل بازگشت نیست.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
