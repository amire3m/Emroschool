"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import CategoryIcon from "@/components/CategoryIcon";
import { primaryCourseCategories } from "@/lib/course-categories";
import { PageHeader, DataTable, Th, Td, EmptyState, PrimaryButton, SecondaryButton, DangerButton, SearchInput, Modal } from "@/components/admin/ui";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  courseCount: number;
}

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "rounded-lg p-2 text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnDangerCls = "rounded-lg p-2 text-slate-400 transition hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

function toSlug(str: string) {
  const map: Record<string, string> = {
    ا: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h",
    خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh",
    ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh",
    ک: "k", گ: "g", ل: "l", م: "m", ن: "n", و: "v", ه: "h", ی: "y",
    " ": "-",
  };
  let slug = "";
  for (const ch of str) {
    slug += map[ch] || ch;
  }
  return slug
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    order: "0",
  });

  const getToken = () => getCookie("token") || "";

  const fetchCategories = () => {
    const token = getToken();
    fetch("/api/categories", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const items = data.categories || data || [];
        setCategories(Array.isArray(items) ? items : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "", icon: "", order: "0" });
    setEditingCategory(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon || "",
      order: String(category.order),
    });
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: editingCategory ? prev.slug : toSlug(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = getToken();

    const body = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      icon: form.icon || null,
      order: Number(form.order) || 0,
    };

    try {
      if (editingCategory) {
        const res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در بروزرسانی");
        }
        toast.success("دسته‌بندی با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در ایجاد دسته‌بندی");
        }
        toast.success("دسته‌بندی با موفقیت ایجاد شد");
      }
      setShowModal(false);
      resetForm();
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.courseCount > 0) {
      toast.error("این دسته‌بندی دارای دوره است و قابل حذف نیست");
      setDeleteTarget(null);
      return;
    }
    setSaving(true);
    const token = getToken();

    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در حذف");
      }
      toast.success("دسته‌بندی با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...categories].sort((a, b) => a.order - b.order);
  const filtered = sorted.filter(
    (c) => c.name.includes(search) || c.slug.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-[#03004b]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600 gap-2">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت دسته‌بندی‌ها"
        actions={
          <PrimaryButton onClick={openCreateModal}>
            <Plus size={18} />
            افزودن دسته‌بندی
          </PrimaryButton>
        }
      />
      <div className="relative w-full sm:w-72">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <SearchInput
          type="text"
          placeholder="جستجوی دسته‌بندی..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        head={
          <>
            <Th>نام</Th>
            <Th className="hidden sm:table-cell">آدرس</Th>
            <Th center className="hidden md:table-cell">آیکون</Th>
            <Th center>تعداد دوره</Th>
            <Th center className="hidden lg:table-cell">ترتیب</Th>
            <Th><span className="flex justify-end">عملیات</span></Th>
          </>
        }
      >
        {filtered.map((category) => (
          <tr key={category.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
            <Td>
              <div className="font-bold text-slate-900">{category.name}</div>
              {category.description && (
                <div className="mt-0.5 max-w-[200px] truncate text-xs text-slate-500">
                  {category.description}
                </div>
              )}
            </Td>
            <Td className="hidden text-slate-500 sm:table-cell"><span dir="ltr">{category.slug}</span></Td>
            <Td className="hidden text-center md:table-cell">
              {category.icon ? (
                <span className="inline-flex text-slate-600"><CategoryIcon name={category.icon} size={24} /></span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </Td>
            <Td className="text-center">
              <span className="font-bold tabular-nums text-slate-900">{category.courseCount}</span>
            </Td>
            <Td className="hidden text-center lg:table-cell">
              <span className="tabular-nums text-slate-500">{category.order}</span>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button
                  type="button"
                  onClick={() => openEditModal(category)}
                  className={iconBtnCls}
                  title="ویرایش"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(category)}
                  className={iconBtnDangerCls}
                  title="حذف"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr className="border-t border-slate-100">
            <Td colSpan={6}>
              <EmptyState message="دسته‌بندی یافت نشد" />
            </Td>
          </tr>
        )}
      </DataTable>

      {showModal && (
        <Modal title={editingCategory ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی جدید"} onClose={() => !saving && setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">نام</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">آدرس در سایت</label>
                <div className="flex items-stretch gap-0">
                  <span className="inline-flex select-none items-center whitespace-nowrap rounded-r-lg border border-slate-200 border-l-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" dir="ltr">
                    imamruhollahschool.com/courses?category=
                  </span>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    className={`min-w-0 flex-1 [direction:ltr] ${inputCls} rounded-r-none tabular-nums`}
                    style={{ fontFamily: "'Courier New', monospace" }}
                  />
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">🔒 بصورت خودکار از عنوان ساخته می‌شود</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-900">توضیحات</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className={`w-full resize-none ${inputCls}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">آیکون</label>
                <select
                  value={form.icon}
                  onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                  className={`w-full ${inputCls}`}
                >
                  <option value="">انتخاب آیکون</option>
                  {primaryCourseCategories.map((category) => (
                    <option key={category.icon} value={category.icon}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">ترتیب</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  className={`w-full tabular-nums ${inputCls}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingCategory ? "بروزرسانی" : "ایجاد دسته‌بندی"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowModal(false)} disabled={saving}>
                انصراف
              </SecondaryButton>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="حذف دسته‌بندی" onClose={() => !saving && setDeleteTarget(null)} maxWidth="max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Trash2 size={24} />
            </div>
            {deleteTarget.courseCount > 0 ? (
              <p className="text-sm text-slate-500">
                این دسته‌بندی دارای {deleteTarget.courseCount} دوره است و قابل حذف نیست.
              </p>
            ) : (
              <>
                <p className="mb-1 text-sm text-slate-600">
                  آیا از حذف دسته‌بندی <span className="font-bold text-slate-900">"{deleteTarget.name}"</span> اطمینان دارید؟
                </p>
                <p className="text-xs text-slate-500">این عمل قابل بازگشت نیست.</p>
              </>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              {deleteTarget.courseCount === 0 && (
                <DangerButton onClick={handleDelete} disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  حذف
                </DangerButton>
              )}
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>
                {deleteTarget.courseCount > 0 ? "متوجه شدم" : "انصراف"}
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
