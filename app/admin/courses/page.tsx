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
   Check,
   Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import PersianDateTimePicker from "@/components/ui/persian-date-time-picker";

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  oldPrice: number | null;
  instructor: string | null;
  categoryName: string | null;
  categoryId: string | null;
  level: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  published: boolean;
  featured: boolean;
  createdAt: string;
  courseType: "comprehensive" | "single";
  scheduleStatus: "upcoming" | "completed";
  startDate: string | null;
  endDate: string | null;
  registrationMode: "purchase" | "registration";
  parentId: string | null;
  parent?: { id: string; title: string } | null;
  childCount?: number;
}

const levels = ["مبتدی", "متوسط", "پیشرفته"];

const levelMap: Record<string, string> = {
  مبتدی: "beginner",
  متوسط: "intermediate",
  پیشرفته: "advanced",
};

const reverseLevelMap: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};

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

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: "",
    oldPrice: "",
    instructor: "",
    category: "",
    level: "",
    thumbnail: "",
    videoUrl: "",
    published: false,
    featured: false,
    courseType: "single",
    scheduleStatus: "upcoming",
    startDate: "",
    endDate: "",
    registrationMode: "purchase",
    parentId: "",
  });

  const getToken = () => getCookie("token") || "";
  const copyCourseLink = async (slug: string) => { await navigator.clipboard.writeText(`${window.location.origin}/courses/${slug}`); toast.success("لینک دوره کپی شد"); };

  const fetchCourses = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/courses", { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch("/api/categories").then((response) => response.json()),
    ])
      .then(([courseData, categoryData]) => {
        if (courseData.courses) setCourses(courseData.courses);
        setCategories(categoryData.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const resetForm = () => {
    setForm({
      title: "",
      slug: "",
      description: "",
      price: "",
      oldPrice: "",
      instructor: "",
      category: "",
      level: "",
      thumbnail: "",
      videoUrl: "",
      published: false,
      featured: false,
      courseType: "single",
      scheduleStatus: "upcoming",
      startDate: "",
      endDate: "",
      registrationMode: "purchase",
      parentId: "",
    });
    setEditingCourse(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (course: Course) => {
    setForm({
      title: course.title,
      slug: course.slug,
      description: course.description,
      price: String(course.price),
      oldPrice: course.oldPrice ? String(course.oldPrice) : "",
      instructor: course.instructor || "",
      category: course.categoryId || categories.find((category) => category.name === course.categoryName)?.id || "",
      level: reverseLevelMap[course.level || ""] || course.level || "",
      thumbnail: course.thumbnail || "",
      videoUrl: course.videoUrl || "",
      published: course.published,
      featured: course.featured,
      courseType: course.courseType || "single",
      scheduleStatus: course.scheduleStatus || "upcoming",
      startDate: course.startDate || "",
      endDate: course.endDate || "",
      registrationMode: course.registrationMode || "purchase",
      parentId: course.parentId || "",
    });
    setEditingCourse(course);
    setShowModal(true);
  };

  const handleTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: editingCourse ? prev.slug : toSlug(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = getToken();

    const selectedCategory = categories.find((category) => category.id === form.category);
    const body = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      price: Number(form.price) || 0,
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
      instructor: form.instructor || null,
      categoryId: selectedCategory?.id || null,
      categoryName: selectedCategory?.name || null,
      level: levelMap[form.level] || form.level || null,
      thumbnail: form.thumbnail || null,
      videoUrl: form.videoUrl || null,
      published: form.published,
      featured: form.featured,
      courseType: form.courseType,
      scheduleStatus: form.scheduleStatus,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      registrationMode: form.registrationMode,
      parentId: form.courseType === "single" ? form.parentId || null : null,
    };

    try {
      if (editingCourse) {
        const res = await fetch(`/api/courses/${editingCourse.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در بروزرسانی");
        }
        toast.success("دوره با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در ایجاد دوره");
        }
        toast.success("دوره با موفقیت ایجاد شد");
      }
      setShowModal(false);
      resetForm();
      fetchCourses();
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
      const res = await fetch(`/api/courses/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در حذف");
      }
      toast.success("دوره با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchCourses();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const filtered = courses.filter(
    (c) =>
      c.title.includes(search) ||
      c.instructor?.includes(search) ||
      c.categoryName?.includes(search)
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
            placeholder="جستجوی دوره..."
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
          افزودن دوره جدید
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">عنوان</th>
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">مدرس</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">قیمت</th>
                <th className="text-right p-3 font-medium text-outline hidden lg:table-cell">دسته</th>
                <th className="text-center p-3 font-medium text-outline">وضعیت</th>
                <th className="text-left p-3 font-medium text-outline">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course) => (
                <tr key={course.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-primary">{course.title}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1"><span className="text-[10px] text-outline">{course.slug}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${course.courseType === "comprehensive" ? "bg-secondary-fixed text-secondary" : "bg-surface-container text-outline"}`}>{course.courseType === "comprehensive" ? `جامع · ${(course.childCount || 0).toLocaleString("fa-IR")} زیر‌دوره` : course.parent ? `فرزند ${course.parent.title}` : "مستقل"}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${course.scheduleStatus === "completed" ? "bg-surface-container text-outline" : "bg-blue-50 text-blue-700"}`}>{course.scheduleStatus === "completed" ? "برگزارشده" : "در انتظار برگزاری"}</span></div>
                  </td>
                  <td className="p-3 text-outline hidden md:table-cell">{course.instructor || "—"}</td>
                  <td className="p-3 hidden sm:table-cell">
                    <span className="font-medium">{course.price.toLocaleString("fa-IR")}</span>
                    <span className="text-xs text-outline mr-1">تومان</span>
                  </td>
                  <td className="p-3 text-outline hidden lg:table-cell">
                    {course.categoryName || "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        course.published
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {course.published ? <Check size={12} /> : <X size={12} />}
                      {course.published ? "منتشر شده" : "پیش‌نویس"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => copyCourseLink(course.slug)} className="p-2 rounded-xl text-outline hover:text-secondary hover:bg-secondary-fixed/30 transition-colors" title="کپی لینک صفحه دوره"><Link2 size={16} /></button>
                      <button
                        onClick={() => openEditModal(course)}
                        className="p-2 rounded-xl text-outline hover:text-[#03004b] hover:bg-[#eeecfc] transition-colors"
                        title="ویرایش"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(course)}
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
                    هیچ دوره‌ای یافت نشد
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
                {editingCourse ? "ویرایش دوره" : "افزودن دوره جدید"}
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
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">آدرس در سایت</label>
                   <div className="space-y-1.5" dir="ltr">
                     <div className="w-full rounded-xl border border-surface-variant bg-surface-low px-3 py-2 text-xs text-outline select-none">imamruhollahschool.com/courses/</div>
                     <input
                      type="text"
                      required
                      value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                       className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                      style={{ fontFamily: "'Courier New', monospace" }}
                    />
                  </div>
                  <p className="text-xs text-outline mt-1 flex items-center gap-1">🔒 بصورت خودکار از عنوان ساخته می‌شود</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">توضیحات</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none"
                />
              </div>

              <div className="rounded-2xl border border-surface-variant bg-surface-low p-4 space-y-4">
                <h4 className="font-bold text-primary text-sm">ساختار و زمان‌بندی دوره</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-primary mb-1">نوع دوره</label><select value={form.courseType} onChange={(e) => setForm((p) => ({ ...p, courseType: e.target.value, parentId: e.target.value === "comprehensive" ? "" : p.parentId }))} className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm"><option value="single">دوره عادی / فرزند</option><option value="comprehensive">دوره جامع (والد)</option></select><p className="text-[11px] text-outline mt-1">دوره جامع برای انتشار باید حداقل یک فرزند داشته باشد.</p></div>
                  {form.courseType === "single" && <div><label className="block text-sm font-medium text-primary mb-1">دوره جامع والد (اختیاری)</label><select value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm"><option value="">دوره مستقل؛ بدون والد</option>{courses.filter((item) => item.courseType === "comprehensive" && item.id !== editingCourse?.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}
                  <div><label className="block text-sm font-medium text-primary mb-1">وضعیت برگزاری</label><select value={form.scheduleStatus} onChange={(e) => setForm((p) => ({ ...p, scheduleStatus: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm"><option value="upcoming">قرار است برگزار شود</option><option value="completed">برگزار شده و پایان یافته</option></select></div>
                  <div><label className="block text-sm font-medium text-primary mb-1">{form.scheduleStatus === "upcoming" ? "تاریخ شروع (شمسی)" : "تاریخ پایان (شمسی)"}</label><PersianDateTimePicker required value={form.scheduleStatus === "upcoming" ? form.startDate : form.endDate} onChange={(value) => setForm((p) => form.scheduleStatus === "upcoming" ? { ...p, startDate: value } : { ...p, endDate: value })} /></div>
                  {form.scheduleStatus === "upcoming" && <div className="sm:col-span-2"><label className="block text-sm font-medium text-primary mb-1">روش اقدام کاربر</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm((p) => ({ ...p, registrationMode: "purchase" }))} className={`p-3 rounded-xl border text-sm font-bold ${form.registrationMode === "purchase" ? "border-primary bg-primary text-white" : "border-surface-variant bg-white text-outline"}`}>خرید دوره</button><button type="button" onClick={() => setForm((p) => ({ ...p, registrationMode: "registration" }))} className={`p-3 rounded-xl border text-sm font-bold ${form.registrationMode === "registration" ? "border-primary bg-primary text-white" : "border-surface-variant bg-white text-outline"}`}>فقط ارسال فرم ثبت‌نام</button></div></div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">قیمت (تومان)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">قیمت قبلی (اختیاری)</label>
                  <input
                    type="number"
                    value={form.oldPrice}
                    onChange={(e) => setForm((p) => ({ ...p, oldPrice: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">مدرس</label>
                  <input
                    type="text"
                    value={form.instructor}
                    onChange={(e) => setForm((p) => ({ ...p, instructor: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">دسته‌بندی</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  >
                    <option value="">انتخاب کنید</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">سطح</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  >
                    <option value="">انتخاب کنید</option>
                    {levels.map((lv) => (
                      <option key={lv} value={lv}>{lv}</option>
                    ))}
                  </select>
                </div>
                <ImageUpload
                  value={form.thumbnail}
                  onChange={(url) => setForm((p) => ({ ...p, thumbnail: url }))}
                  label="تصویر شاخص دوره"
                  sizeHint="۹۰۰ × ۱۶۰۰ پیکسل"
                  aspectRatio="9:16"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">آدرس ویدئو</label>
                <input
                  type="text"
                  value={form.videoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                    className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                  />
                  <span className="text-sm text-primary">منتشر شده</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                    className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                  />
                  <span className="text-sm text-primary">ویژه</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingCourse ? "بروزرسانی" : "ایجاد دوره"}
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
              <h3 className="text-lg font-bold text-primary mb-2">حذف دوره</h3>
              <p className="text-outline text-sm mb-1">
                آیا از حذف دوره <span className="font-bold text-primary">"{deleteTarget.title}"</span> اطمینان دارید؟
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
