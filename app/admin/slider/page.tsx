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
import { PageHeader, DataTable, Th, Td, Badge, EmptyState, PrimaryButton, SecondaryButton, DangerButton, SearchInput, Modal } from "@/components/admin/ui";

interface SliderItem {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  linkText: string | null;
  order: number;
  published: boolean;
  createdAt: string;
}

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "rounded-lg p-2 text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnDangerCls = "rounded-lg p-2 text-slate-400 transition hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const orderBtnCls = "rounded p-0.5 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

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
      title: slide.title || "",
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
    const orderedSlides = [...slides].sort((a, b) => a.order - b.order);
    const idx = orderedSlides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === slides.length - 1) return;

    const newSlides = [...orderedSlides];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const currentOrder = newSlides[idx].order;
    const swapOrder = newSlides[swapIdx].order;
    [newSlides[idx], newSlides[swapIdx]] = [newSlides[swapIdx], newSlides[idx]];

    const token = getToken();
    try {
      const responses = await Promise.all([
        fetch(`/api/slider/${newSlides[idx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ order: currentOrder }),
        }),
        fetch(`/api/slider/${newSlides[swapIdx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ order: swapOrder }),
        }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("خطا در تغییر ترتیب");
      fetchSlides();
    } catch {
      toast.error("خطا در تغییر ترتیب");
    }
  };

  const sorted = [...slides].sort((a, b) => a.order - b.order);
  const filtered = sorted.filter(
    (s) =>
      (s.title || "").includes(search) ||
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
      <div className="flex items-center justify-center h-64 text-red-600 gap-2">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت اسلایدر"
        actions={
          <PrimaryButton onClick={openCreateModal}>
            <Plus size={18} />
            افزودن اسلاید
          </PrimaryButton>
        }
      />
      <div className="relative w-full sm:w-72">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <SearchInput
          type="text"
          placeholder="جستجوی اسلاید..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        head={
          <>
            <Th>تصویر</Th>
            <Th>عنوان</Th>
            <Th className="hidden md:table-cell">زیرعنوان</Th>
            <Th center>ترتیب</Th>
            <Th center>وضعیت</Th>
            <Th><span className="flex justify-end">عملیات</span></Th>
          </>
        }
      >
        {filtered.map((slide, index) => (
          <tr key={slide.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
            <Td>
              <div className="h-10 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img
                  src={slide.imageUrl}
                  alt={slide.title || "تصویر اسلاید"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/100x60/e2e1f0/777681?text=No+Image";
                  }}
                />
              </div>
            </Td>
            <Td>
              <div className="font-bold text-slate-900">{slide.title || "بدون عنوان"}</div>
            </Td>
            <Td className="hidden text-slate-500 md:table-cell">{slide.subtitle || "—"}</Td>
            <Td className="text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="ml-1 text-xs tabular-nums text-slate-500">{slide.order}</span>
                <button
                  type="button"
                  onClick={() => moveOrder(slide.id, "up")}
                  disabled={index === 0}
                  className={orderBtnCls}
                  aria-label="انتقال به بالا"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveOrder(slide.id, "down")}
                  disabled={index === filtered.length - 1}
                  className={orderBtnCls}
                  aria-label="انتقال به پایین"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </Td>
            <Td className="text-center">
              <Badge tone={slide.published ? "emerald" : "slate"}>
                {slide.published ? <Check size={12} /> : <X size={12} />}
                {slide.published ? "منتشر شده" : "پیش‌نویس"}
              </Badge>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button
                  type="button"
                  onClick={() => openEditModal(slide)}
                  className={iconBtnCls}
                  title="ویرایش"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(slide)}
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
              <EmptyState message="هیچ اسلایدی یافت نشد" />
            </Td>
          </tr>
        )}
      </DataTable>

      {showModal && (
        <Modal title={editingSlide ? "ویرایش اسلاید" : "افزودن اسلاید جدید"} onClose={() => !saving && setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">عنوان</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className={`w-full ${inputCls}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">زیرعنوان</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                  className={`w-full ${inputCls}`}
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
                <label className="mb-1 block text-sm font-bold text-slate-900">آدرس لینک</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.linkUrl}
                  onChange={(e) => setForm((p) => ({ ...p, linkUrl: e.target.value }))}
                  className={`w-full ${inputCls}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">متن لینک</label>
                <input
                  type="text"
                  value={form.linkText}
                  onChange={(e) => setForm((p) => ({ ...p, linkText: e.target.value }))}
                  className={`w-full ${inputCls}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-900">ترتیب</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  className={`w-full tabular-nums ${inputCls}`}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[#03004b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
                  />
                  <span className="text-sm text-slate-900">منتشر شده</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingSlide ? "بروزرسانی" : "ایجاد اسلاید"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowModal(false)} disabled={saving}>
                انصراف
              </SecondaryButton>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="حذف اسلاید" onClose={() => !saving && setDeleteTarget(null)} maxWidth="max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Trash2 size={24} />
            </div>
            <p className="text-sm text-slate-600">
              آیا از حذف اسلاید <span className="font-bold text-slate-900">"{deleteTarget.title}"</span> اطمینان دارید؟
            </p>
            <p className="mt-1 text-xs text-slate-500">این عمل قابل بازگشت نیست.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <DangerButton onClick={handleDelete} disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                حذف
              </DangerButton>
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>
                انصراف
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
