"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  FolderOpen,
  ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";

interface GalleryImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  folder: string | null;
  courseId: string | null;
  createdAt: string;
}

interface Course {
  id: string;
  title: string;
}

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [form, setForm] = useState({
    courseId: "",
    imageUrl: "",
    folder: "",
    altText: "",
  });

  const getToken = () => getCookie("token") || "";

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
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          imageUrl: form.imageUrl,
          altText: form.altText || null,
          folder: form.folder || null,
          courseId: form.courseId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا");
      }
      toast.success("تصویر با موفقیت افزوده شد");
      setShowModal(false);
      setForm({ courseId: "", imageUrl: "", folder: "", altText: "" });
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveFolder(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFolder === null
                ? "bg-[#03004b] text-white"
                : "bg-surface-variant text-outline hover:bg-[#e2e1f0]"
            }`}
          >
            همه
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFolder === folder
                  ? "bg-[#03004b] text-white"
                  : "bg-surface-variant text-outline hover:bg-[#e2e1f0]"
              }`}
            >
              <FolderOpen size={14} />
              {folder}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#03004b] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors shrink-0"
        >
          <Plus size={18} />
          افزودن تصویر
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-variant shadow-sm p-12 text-center">
          <ImageIcon size={48} className="mx-auto text-outline-variant mb-3" />
          <p className="text-outline">تصویری یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((image) => (
            <div
              key={image.id}
              className="group relative bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-surface-variant overflow-hidden">
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
                  <div className="flex items-center gap-1 text-xs text-outline mb-1">
                    <FolderOpen size={12} />
                    {image.folder}
                  </div>
                )}
                <div className="text-xs text-[#03004b] font-medium truncate">
                  {getCourseTitle(image.courseId)}
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("آیا از حذف این تصویر اطمینان دارید؟")) {
                    handleDelete(image.id);
                  }
                }}
                className="absolute top-2 left-2 p-1.5 rounded-lg bg-white/80 text-outline hover:text-error hover:bg-error-container opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">افزودن تصویر جدید</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-outline hover:text-primary p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">دوره (اختیاری)</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
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

              <div>
                <label className="block text-sm font-medium text-primary mb-1">پوشه</label>
                <input
                  type="text"
                  value={form.folder}
                  onChange={(e) => setForm((p) => ({ ...p, folder: e.target.value }))}
                  list="folder-suggestions"
                  placeholder="مثال: workshop-1"
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                />
                <datalist id="folder-suggestions">
                  {existingFolders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">متن جایگزین</label>
                <input
                  type="text"
                  value={form.altText}
                  onChange={(e) => setForm((p) => ({ ...p, altText: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  افزودن تصویر
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
    </div>
  );
}
