"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  MapPin,
   Calendar,
   Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
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
  instructorCount: number;
  instructors?: { id: string; name: string; avatar?: string | null }[];
}

interface Instructor {
  id: string;
  name: string | null;
  avatar: string | null;
  user?: { name: string; avatar?: string | null } | null;
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

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function AdminEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [instructorSearch, setInstructorSearch] = useState("");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    startDate: "",
    endDate: "",
    location: "",
    imageUrl: "",
    published: false,
    instructorIds: [] as string[],
  });

  const getToken = () => getCookie("token") || "";
  const copyEventLink = async (slug: string) => { await navigator.clipboard.writeText(`${window.location.origin}/events/${slug}`); toast.success("لینک رویداد کپی شد"); };

  const fetchData = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/events", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/instructors", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([eventsData, instructorsData]) => {
        const items = eventsData.events || eventsData || [];
        setEvents(Array.isArray(items) ? items : []);
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
      instructorIds: [],
    });
    setEditingEvent(null);
  };

  const openCreateModal = () => {
    resetForm();
    setInstructorSearch("");
    setShowModal(true);
  };

  const openEditModal = (event: EventItem) => {
    setInstructorSearch("");
    setForm({
      title: event.title,
      slug: event.slug,
      description: event.description,
      startDate: event.startDate || "",
      endDate: event.endDate || "",
      location: event.location || "",
      imageUrl: event.imageUrl || "",
      published: event.published,
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-red-600">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="مدیریت رویدادها"
        actions={
          <PrimaryButton onClick={openCreateModal}>
            <Plus size={18} />
            افزودن رویداد
          </PrimaryButton>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <SearchInput
            type="text"
            placeholder="جستجوی رویداد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        minWidth={720}
        head={
          <>
            <Th>عنوان</Th>
            <Th className="hidden sm:table-cell">تاریخ شروع</Th>
            <Th className="hidden md:table-cell">مکان</Th>
            <Th center className="hidden lg:table-cell">اساتید</Th>
            <Th center>وضعیت</Th>
            <Th>عملیات</Th>
          </>
        }
      >
              {filtered.map((event) => (
                <tr key={event.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                  <Td>
                    <div className="font-medium text-slate-900">{event.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500" dir="ltr">{event.slug}</div>
                  </Td>
                  <Td className="hidden text-slate-500 sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      <span className="tabular-nums">{formatDate(event.startDate)}</span>
                    </div>
                  </Td>
                  <Td className="hidden text-slate-500 md:table-cell">
                    {event.location ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400" />
                        {event.location}
                      </div>
                    ) : "—"}
                  </Td>
                  <Td className="hidden text-center lg:table-cell">
                      <span className="font-medium tabular-nums text-slate-900">{event.instructorCount.toLocaleString("fa-IR")}</span>
                  </Td>
                  <Td className="text-center">
                    <Badge tone={event.published ? "emerald" : "slate"}>
                      {event.published ? "منتشر شده" : "پیش‌نویس"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1 justify-end">
                      <button type="button" onClick={() => copyEventLink(event.slug)} className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="کپی لینک صفحه رویداد"><Link2 size={16} /></button>
                      <button
                        type="button"
                        onClick={() => openEditModal(event)}
                        className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`}
                        title="ویرایش"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(event)}
                        className={`rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 ${FOCUS_VISIBLE}`}
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <Td colSpan={6}><EmptyState message="هیچ رویدادی یافت نشد" /></Td>
                </tr>
              )}
      </DataTable>

      {showModal && (
        <Modal
          title={editingEvent ? "ویرایش رویداد" : "افزودن رویداد جدید"}
          onClose={() => { if (!saving) setShowModal(false); }}
          maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">عنوان</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className={`w-full ${INPUT_CLASS}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">آدرس در سایت</label>
                   <div className="space-y-1.5" dir="ltr">
                     <div className="w-full select-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">imamruhollahschool.com/events/</div>
                     <input
                      type="text"
                      required
                      value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                       className={`w-full ${INPUT_CLASS}`}
                      style={{ fontFamily: "'Courier New', monospace" }}
                    />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">🔒 بصورت خودکار از عنوان ساخته می‌شود</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">توضیحات</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className={`w-full resize-none ${INPUT_CLASS}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">تاریخ شروع</label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    format="YYYY/MM/DD HH:mm:ss"
                    plugins={[<TimePicker position="bottom" />]}
                    value={form.startDate ? new Date(form.startDate) : undefined}
                    onChange={(date) => {
                       setForm((p) => ({ ...p, startDate: date ? date.toDate().toISOString() : "" }));
                    }}
                    inputClass={INPUT_CLASS}
                    containerClassName="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">تاریخ پایان</label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    format="YYYY/MM/DD HH:mm:ss"
                    plugins={[<TimePicker position="bottom" />]}
                    value={form.endDate ? new Date(form.endDate) : undefined}
                    onChange={(date) => {
                       setForm((p) => ({ ...p, endDate: date ? date.toDate().toISOString() : "" }));
                    }}
                    inputClass={INPUT_CLASS}
                    containerClassName="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">مکان</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                    className={`w-full ${INPUT_CLASS}`}
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
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[#03004b]"
                  />
                  <span className="text-sm text-slate-900">منتشر شده</span>
                </label>
              </div>

              <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">اساتید رویداد</label>
                  <p className="mb-2 text-xs text-slate-500">می‌توانید چند استاد را از فهرست اساتید سایت انتخاب کنید.</p>
                  <input value={instructorSearch} onChange={(event) => setInstructorSearch(event.target.value)} placeholder="جستجوی نام استاد..." className={`mb-2 w-full ${INPUT_CLASS}`} />
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {instructors.length === 0 && (
                      <p className="p-2 text-xs text-slate-500">استادی یافت نشد</p>
                    )}
                    {instructors.filter((inst) => (inst.name || inst.user?.name || "").includes(instructorSearch.trim())).map((inst) => (
                      <label
                        key={inst.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.instructorIds.includes(inst.id)}
                          onChange={() => toggleInstructorId(inst.id)}
                          className="h-4 w-4 rounded accent-[#03004b]"
                        />
                        {inst.avatar || inst.user?.avatar ? <img src={inst.avatar || inst.user?.avatar || ""} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">{(inst.name || inst.user?.name || "؟").charAt(0)}</span>}
                        <span className="text-sm text-slate-900">{inst.name || inst.user?.name || "نامشخص"}</span>
                      </label>
                    ))}
                    {instructors.length > 0 && !instructors.some((inst) => (inst.name || inst.user?.name || "").includes(instructorSearch.trim())) && <p className="p-2 text-xs text-slate-500">استادی با این نام یافت نشد</p>}
                  </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <PrimaryButton type="submit" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingEvent ? "بروزرسانی" : "ایجاد رویداد"}
                </PrimaryButton>
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

      {deleteTarget && (
        <Modal
          title="حذف رویداد"
          onClose={() => { if (!saving) setDeleteTarget(null); }}
          maxWidth="max-w-md"
          footer={
            <>
              <DangerButton onClick={handleDelete} disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                حذف
              </DangerButton>
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>
                انصراف
              </SecondaryButton>
            </>
          }
        >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <p className="mb-1 text-sm text-slate-500">
                آیا از حذف رویداد <span className="font-bold text-slate-900">"{deleteTarget.title}"</span> اطمینان دارید؟
              </p>
              <p className="text-xs text-slate-500">این عمل قابل بازگشت نیست.</p>
            </div>
        </Modal>
      )}
    </div>
  );
}
