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
  MapPin,
   Calendar,
   Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import DatePicker from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  imageUrl: string | null;
  published: boolean;
  courseCount: number;
  instructorCount: number;
  courses?: { id: string; title: string }[];
  instructors?: { id: string; name: string }[];
}

interface Course {
  id: string;
  title: string;
}

interface Instructor {
  id: string;
  user: { name: string };
}

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

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AdminEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    startDate: "",
    endDate: "",
    location: "",
    imageUrl: "",
    published: false,
    courseIds: [] as string[],
    instructorIds: [] as string[],
  });

  const getToken = () => getCookie("token") || "";
  const copyEventLink = async (slug: string) => { await navigator.clipboard.writeText(`${window.location.origin}/events/${slug}`); toast.success("لینک رویداد کپی شد"); };

  const fetchData = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/events", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/courses", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/instructors", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([eventsData, coursesData, instructorsData]) => {
        const items = eventsData.events || eventsData || [];
        setEvents(Array.isArray(items) ? items : []);
        if (coursesData.courses) setCourses(coursesData.courses);
        if (instructorsData.instructors) setInstructors(instructorsData.instructors);
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

  const resetForm = () => {
    setForm({
      title: "",
      slug: "",
      description: "",
      startDate: "",
      endDate: "",
      location: "",
      imageUrl: "",
      published: false,
      courseIds: [],
      instructorIds: [],
    });
    setEditingEvent(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (event: EventItem) => {
    setForm({
      title: event.title,
      slug: event.slug,
      description: event.description,
      startDate: event.startDate || "",
      endDate: event.endDate || "",
      location: event.location || "",
      imageUrl: event.imageUrl || "",
      published: event.published,
      courseIds: event.courses?.map((c) => c.id) || [],
      instructorIds: event.instructors?.map((i) => i.id) || [],
    });
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: editingEvent ? prev.slug : toSlug(value),
    }));
  };

  const toggleCourseId = (id: string) => {
    setForm((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(id)
        ? prev.courseIds.filter((c) => c !== id)
        : [...prev.courseIds, id],
    }));
  };

  const toggleInstructorId = (id: string) => {
    setForm((prev) => ({
      ...prev,
      instructorIds: prev.instructorIds.includes(id)
        ? prev.instructorIds.filter((i) => i !== id)
        : [...prev.instructorIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = getToken();

    const body = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      location: form.location || null,
      imageUrl: form.imageUrl || null,
      published: form.published,
      courseIds: form.courseIds,
      instructorIds: form.instructorIds,
    };

    try {
      if (editingEvent) {
        const res = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در بروزرسانی");
        }
        toast.success("رویداد با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در ایجاد رویداد");
        }
        toast.success("رویداد با موفقیت ایجاد شد");
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
      const res = await fetch(`/api/events/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در حذف");
      }
      toast.success("رویداد با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const filtered = events.filter(
    (e) =>
      e.title.includes(search) ||
      e.location?.includes(search)
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
            placeholder="جستجوی رویداد..."
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
          افزودن رویداد
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">عنوان</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">تاریخ شروع</th>
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">مکان</th>
                <th className="text-center p-3 font-medium text-outline hidden lg:table-cell">دوره‌ها</th>
                <th className="text-center p-3 font-medium text-outline">وضعیت</th>
                <th className="text-left p-3 font-medium text-outline">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-primary">{event.title}</div>
                    <div className="text-xs text-outline mt-0.5">{event.slug}</div>
                  </td>
                  <td className="p-3 text-outline hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDate(event.startDate)}
                    </div>
                  </td>
                  <td className="p-3 text-outline hidden md:table-cell">
                    {event.location ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} />
                        {event.location}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-center hidden lg:table-cell">
                    <span className="font-medium">{event.courseCount}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        event.published
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {event.published ? <Check size={12} /> : <X size={12} />}
                      {event.published ? "منتشر شده" : "پیش‌نویس"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => copyEventLink(event.slug)} className="p-2 rounded-xl text-outline hover:text-secondary hover:bg-secondary-fixed/30 transition-colors" title="کپی لینک صفحه رویداد"><Link2 size={16} /></button>
                      <button
                        onClick={() => openEditModal(event)}
                        className="p-2 rounded-xl text-outline hover:text-[#03004b] hover:bg-[#eeecfc] transition-colors"
                        title="ویرایش"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(event)}
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
                    هیچ رویدادی یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">
                {editingEvent ? "ویرایش رویداد" : "افزودن رویداد جدید"}
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
                   <div className="flex items-stretch gap-0" dir="ltr">
                     <span className="inline-flex items-center px-3 py-2.5 rounded-l-xl border border-r-0 border-surface-variant bg-surface-low text-outline text-sm select-none whitespace-nowrap">
                       imamruhollahschool.com/events/
                    </span>
                    <input
                      type="text"
                      required
                      value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                       className="flex-1 min-w-0 px-3 py-2.5 rounded-r-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">تاریخ شروع</label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    format="YYYY/MM/DD HH:mm:ss"
                    plugins={[<TimePicker position="bottom" />]}
                    value={form.startDate ? new Date(form.startDate) : undefined}
                    onChange={(date) => {
                       setForm((p) => ({ ...p, startDate: date ? date.toDate().toISOString() : "" }));
                    }}
                    inputClass="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                    containerClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">تاریخ پایان</label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    format="YYYY/MM/DD HH:mm:ss"
                    plugins={[<TimePicker position="bottom" />]}
                    value={form.endDate ? new Date(form.endDate) : undefined}
                    onChange={(date) => {
                       setForm((p) => ({ ...p, endDate: date ? date.toDate().toISOString() : "" }));
                    }}
                    inputClass="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                    containerClassName="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">مکان</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                </div>
                <ImageUpload
                  value={form.imageUrl}
                  onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
                  label="تصویر رویداد"
                  sizeHint="۹۰۰ × ۱۶۰۰ پیکسل"
                  aspectRatio="9:16"
                />
              </div>

              <div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">دوره‌های مرتبط</label>
                  <div className="max-h-40 overflow-y-auto border border-surface-variant rounded-xl p-2 space-y-1">
                    {courses.length === 0 && (
                      <p className="text-xs text-outline p-2">دوره‌ای یافت نشد</p>
                    )}
                    {courses.map((course) => (
                      <label
                        key={course.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-low cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.courseIds.includes(course.id)}
                          onChange={() => toggleCourseId(course.id)}
                          className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                        />
                        <span className="text-sm text-primary">{course.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">اساتید مرتبط</label>
                  <div className="max-h-40 overflow-y-auto border border-surface-variant rounded-xl p-2 space-y-1">
                    {instructors.length === 0 && (
                      <p className="text-xs text-outline p-2">استادی یافت نشد</p>
                    )}
                    {instructors.map((inst) => (
                      <label
                        key={inst.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-low cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.instructorIds.includes(inst.id)}
                          onChange={() => toggleInstructorId(inst.id)}
                          className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                        />
                        <span className="text-sm text-primary">{inst.user?.name || "نامشخص"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingEvent ? "بروزرسانی" : "ایجاد رویداد"}
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
              <h3 className="text-lg font-bold text-primary mb-2">حذف رویداد</h3>
              <p className="text-outline text-sm mb-1">
                آیا از حذف رویداد <span className="font-bold text-primary">"{deleteTarget.title}"</span> اطمینان دارید؟
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
