"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  ImageIcon,
   Pencil,
   Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import PersianDateTimePicker from "@/components/ui/persian-date-time-picker";
import { EmptyState, FilterChips, Modal, PageHeader, PrimaryButton, SecondaryButton } from "@/components/admin/ui";

interface GalleryImage {
  id: string;
  imageUrl: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  altText: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  capturedAt: string | null;
  folder: string | null;
  courseId: string | null;
  createdAt: string;
}

const emptyForm = { courseId: "", imageUrl: "", title: "", slug: "", description: "", folder: "", altText: "", capturedAt: "" };

interface Course {
  id: string;
  title: string;
}

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "p-1.5 rounded-lg bg-white/80 text-slate-500 transition hover:text-slate-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [form, setForm] = useState(emptyForm);

  const getToken = () => getCookie("token") || "";
  const copyGalleryLink = async (slug: string | null) => { if (!slug) return toast.error("ابتدا برای تصویر آدرس صفحه تعیین کنید"); await navigator.clipboard.writeText(`${window.location.origin}/gallery/${slug}`); toast.success("لینک تصویر کپی شد"); };

  const fetchData = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/gallery", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/courses", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([galleryData, coursesData]) => {
        if (galleryData.images) setImages(galleryData.images);
        if (coursesData.courses) setCourses(coursesData.courses);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const folders = [...new Set(images.map((img) => img.folder).filter(Boolean))] as string[];
  const filtered = activeFolder ? images.filter((img) => img.folder === activeFolder) : images;

  const getCourseTitle = (courseId: string | null) => {
    if (!courseId) return "آلبوم آزاد";
    return courses.find((c) => c.id === courseId)?.title || "نامشخص";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) {
      toast.error("آدرس تصویر الزامی است");
      return;
    }
    setSaving(true);
    const token = getToken();

    try {
      const res = await fetch(editing ? `/api/gallery/${editing.id}` : "/api/gallery", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          imageUrl: form.imageUrl,
          title: form.title,
          slug: form.slug,
          description: form.description || null,
          altText: form.altText || null,
          capturedAt: form.capturedAt || null,
          folder: form.folder || null,
          courseId: form.courseId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا");
      }
      toast.success(editing ? "اطلاعات تصویر بروزرسانی شد" : "تصویر با موفقیت افزوده شد");
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا");
      }
      toast.success("تصویر حذف شد");
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  };

  const existingFolders = [...new Set(images.map((i) => i.folder).filter((f): f is string => !!f))];
  const folderOptions = [{ value: "__all__", label: "همه" }, ...folders.map((folder) => ({ value: folder, label: folder }))];

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
        title="گالری تصاویر"
        subtitle="مدیریت تصاویر گالری سایت"
        actions={
          <PrimaryButton
            onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}
            className="shrink-0"
          >
            <Plus size={18} />
            افزودن تصویر
          </PrimaryButton>
        }
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <FilterChips options={folderOptions} value={activeFolder ?? "__all__"} onChange={(value) => setActiveFolder(value === "__all__" ? null : value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-10 text-center">
          <ImageIcon size={48} className="mx-auto text-slate-300" />
          <EmptyState message="تصویری یافت نشد" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((image) => (
            <div
              key={image.id}
              className="group relative rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-slate-100 overflow-hidden">
                <img
                  src={image.imageUrl}
                  alt={image.altText || ""}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/400x225/e2e1f0/777681?text=No+Image";
                  }}
                />
              </div>
              <div className="p-3">
                {image.folder && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <FolderOpen size={12} />
                    {image.folder}
                  </div>
                )}
                <div className="text-xs text-slate-900 font-medium truncate">
                  {image.title || getCourseTitle(image.courseId)}
                </div>
                {image.description && <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{image.description}</p>}
              </div>
               <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all"><button type="button" onClick={() => copyGalleryLink(image.slug)} className={iconBtnCls}><Link2 size={14} /></button><button type="button" onClick={() => { setEditing(image); setForm({ courseId: image.courseId || "", imageUrl: image.imageUrl, title: image.title || "", slug: image.slug || "", description: image.description || "", folder: image.folder || "", altText: image.altText || "", capturedAt: image.capturedAt || "" }); setShowModal(true); }} className={iconBtnCls}><Pencil size={14} /></button></div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("آیا از حذف این تصویر اطمینان دارید؟")) {
                    handleDelete(image.id);
                  }
                }}
                className="absolute top-2 left-2 p-1.5 rounded-lg bg-white/80 text-slate-500 transition hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "ویرایش اطلاعات تصویر" : "افزودن تصویر جدید"} onClose={() => !saving && setShowModal(false)} maxWidth="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">دوره (اختیاری)</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                  className={`w-full ${inputCls}`}
                >
                  <option value="">آلبوم آزاد (بدون دوره)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <ImageUpload
                value={form.imageUrl}
                onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
                label="تصویر گالری"
                sizeHint="۱۹۲۰ × ۱۰۸۰ پیکسل"
                aspectRatio="16:9"
              />

              <div className="grid sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-900 mb-1">عنوان تصویر</label><input required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className={`w-full ${inputCls}`} /></div><div><label className="block text-sm font-medium text-slate-900 mb-1">آدرس صفحه</label><div className="space-y-1.5" dir="ltr"><div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">imamruhollahschool.com/gallery/</div><input required value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} className={`w-full ${inputCls}`} /></div></div></div>

              <div><label className="block text-sm font-medium text-slate-900 mb-1">توضیحات تصویر / آلبوم</label><textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className={`w-full ${inputCls}`} /></div>
              <div><label className="block text-sm font-medium text-slate-900 mb-1">تاریخ ثبت تصویر (شمسی)</label><PersianDateTimePicker value={form.capturedAt} onChange={(capturedAt) => setForm((p) => ({ ...p, capturedAt }))} /></div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">پوشه</label>
                <input
                  type="text"
                  value={form.folder}
                  onChange={(e) => setForm((p) => ({ ...p, folder: e.target.value }))}
                  list="folder-suggestions"
                  placeholder="مثال: workshop-1"
                  className={`w-full ${inputCls}`}
                />
                <datalist id="folder-suggestions">
                  {existingFolders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">متن جایگزین</label>
                <input
                  type="text"
                  value={form.altText}
                  onChange={(e) => setForm((p) => ({ ...p, altText: e.target.value }))}
                  className={`w-full ${inputCls}`}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#03004b] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#1b1c5e] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editing ? "ذخیره تغییرات" : "افزودن تصویر"}
                </button>
                <SecondaryButton
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  انصراف
                </SecondaryButton>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
