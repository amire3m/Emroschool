"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Search,
  X,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";

interface SliderItem {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  linkText: string | null;
  order: number;
  published: boolean;
  createdAt: string;
}

export default function AdminSlider() {
  const [slides, setSlides] = useState<SliderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SliderItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SliderItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    linkText: "",
    order: "0",
    published: true,
  });

  const getToken = () => getCookie("token") || "";

  const fetchSlides = () => {
    const token = getToken();
    fetch("/api/slider", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const items = data.slides || data.slider || data || [];
        setSlides(Array.isArray(items) ? items : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  const resetForm = () => {
    setForm({
      title: "",
      subtitle: "",
      imageUrl: "",
      linkUrl: "",
      linkText: "",
      order: "0",
      published: true,
    });
    setEditingSlide(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (slide: SliderItem) => {
    setForm({
      title: slide.title,
      subtitle: slide.subtitle || "",
      imageUrl: slide.imageUrl,
      linkUrl: slide.linkUrl || "",
      linkText: slide.linkText || "",
      order: String(slide.order),
      published: slide.published,
    });
    setEditingSlide(slide);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = getToken();

    const body = {
      title: form.title,
      subtitle: form.subtitle || null,
      imageUrl: form.imageUrl,
      linkUrl: form.linkUrl || null,
      linkText: form.linkText || null,
      order: Number(form.order) || 0,
      published: form.published,
    };

    try {
      if (editingSlide) {
        const res = await fetch(`/api/slider/${editingSlide.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در بروزرسانی");
        }
        toast.success("اسلاید با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/slider", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در ایجاد اسلاید");
        }
        toast.success("اسلاید با موفقیت ایجاد شد");
      }
      setShowModal(false);
      resetForm();
      fetchSlides();
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
      const res = await fetch(`/api/slider/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در حذف");
      }
      toast.success("اسلاید با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchSlides();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const moveOrder = async (id: string, direction: "up" | "down") => {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === slides.length - 1) return;

    const newSlides = [...slides];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newSlides[idx], newSlides[swapIdx]] = [newSlides[swapIdx], newSlides[idx]];

    const token = getToken();
    try {
      await Promise.all([
        fetch(`/api/slider/${newSlides[idx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ order: newSlides[idx].order }),
        }),
        fetch(`/api/slider/${newSlides[swapIdx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ order: newSlides[swapIdx].order }),
        }),
      ]);
      fetchSlides();
    } catch {
      toast.error("خطا در تغییر ترتیب");
    }
  };

  const sorted = [...slides].sort((a, b) => a.order - b.order);
  const filtered = sorted.filter(
    (s) =>
      s.title.includes(search) ||
      s.subtitle?.includes(search)
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
      <div className="flex items-center justify-center h-64 text-error gap-2">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder="جستجوی اسلاید..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] focus:border-[#03004b]"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#03004b] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors"
        >
          <Plus size={18} />
          افزودن اسلاید
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">تصویر</th>
                <th className="text-right p-3 font-medium text-outline">عنوان</th>
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">زیرعنوان</th>
                <th className="text-center p-3 font-medium text-outline">ترتیب</th>
                <th className="text-center p-3 font-medium text-outline">وضعیت</th>
                <th className="text-left p-3 font-medium text-outline">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((slide, index) => (
                <tr key={slide.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="w-16 h-10 rounded-lg bg-surface-variant overflow-hidden">
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/100x60/e2e1f0/777681?text=No+Image";
                        }}
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-primary">{slide.title}</div>
                  </td>
                  <td className="p-3 text-outline hidden md:table-cell">{slide.subtitle || "—"}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-outline text-xs ml-1">{slide.order}</span>
                      <button
                        onClick={() => moveOrder(slide.id, "up")}
                        disabled={index === 0}
                        className="p-0.5 rounded text-outline hover:text-[#03004b] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moveOrder(slide.id, "down")}
                        disabled={index === filtered.length - 1}
                        className="p-0.5 rounded text-outline hover:text-[#03004b] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        slide.published
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {slide.published ? <Check size={12} /> : <X size={12} />}
                      {slide.published ? "منتشر شده" : "پیش‌نویس"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEditModal(slide)}
                        className="p-2 rounded-xl text-outline hover:text-[#03004b] hover:bg-[#eeecfc] transition-colors"
                        title="ویرایش"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(slide)}
                        className="p-2 rounded-xl text-outline hover:text-error hover:bg-error-container transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-outline">
                    هیچ اسلایدی یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">
                {editingSlide ? "ویرایش اسلاید" : "افزودن اسلاید جدید"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-outline hover:text-primary p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">عنوان</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">زیرعنوان</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
              </div>

              <ImageUpload
                value={form.imageUrl}
                onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
                label="تصویر اسلاید"
                sizeHint="۱۹۲۰ × ۱۰۸۰ پیکسل"
                aspectRatio="16:9"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">آدرس لینک</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.linkUrl}
                    onChange={(e) => setForm((p) => ({ ...p, linkUrl: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">متن لینک</label>
                  <input
                    type="text"
                    value={form.linkText}
                    onChange={(e) => setForm((p) => ({ ...p, linkText: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">ترتیب</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                      className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                    />
                    <span className="text-sm text-primary">منتشر شده</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingSlide ? "بروزرسانی" : "ایجاد اسلاید"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !saving && setDeleteTarget(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-error" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">حذف اسلاید</h3>
              <p className="text-outline text-sm mb-1">
                آیا از حذف اسلاید <span className="font-bold text-primary">"{deleteTarget.title}"</span> اطمینان دارید؟
              </p>
              <p className="text-outline text-xs">این عمل قابل بازگشت نیست.</p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-2 bg-error text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  حذف
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
