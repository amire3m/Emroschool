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
  Calendar,
  Eye,
  EyeOff,
  Upload,
  Link,
  ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

interface Instructor {
  id: string;
  userId: string;
  bio: string | null;
  expertise: string | null;
  specialties: string | null;
  showOnSite: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  createdAt: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Instructor | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarMode, setAvatarMode] = useState<"file" | "url">("url");

  const [form, setForm] = useState({
    userId: "",
    bio: "",
    expertise: "",
    specialties: "",
    showOnSite: true,
    avatar: "",
  });

  const getToken = () => getCookie("token") || "";

  const fetchData = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/instructors", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/users", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([instructorsData, usersData]) => {
        const items = instructorsData.instructors || instructorsData || [];
        setInstructors(Array.isArray(items) ? items : []);
        if (usersData.users) setUsers(usersData.users);
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

  const instructorUserIds = new Set(instructors.map((i) => i.userId));
  const availableUsers = users.filter((u) => !instructorUserIds.has(u.id));

  const resetForm = () => {
    setForm({ userId: "", bio: "", expertise: "", specialties: "", showOnSite: true, avatar: "" });
    setEditingInstructor(null);
    setAvatarMode("url");
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (instructor: Instructor) => {
    setForm({
      userId: instructor.userId,
      bio: instructor.bio || "",
      expertise: instructor.expertise || "",
      specialties: instructor.specialties || "",
      showOnSite: instructor.showOnSite,
      avatar: instructor.user.avatar || "",
    });
    setEditingInstructor(instructor);
    setShowModal(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error("خطا در آپلود");
      const data = await res.json();
      setForm((p) => ({ ...p, avatar: data.url }));
      toast.success("تصویر با موفقیت آپلود شد");
    } catch {
      toast.error("خطا در آپلود تصویر");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInstructor && !form.userId) {
      toast.error("انتخاب کاربر الزامی است");
      return;
    }
    setSaving(true);
    const token = getToken();

    const body: Record<string, unknown> = {
      userId: form.userId,
      bio: form.bio || null,
      expertise: form.expertise || null,
      specialties: form.specialties || null,
      showOnSite: form.showOnSite,
    };

    try {
      if (editingInstructor) {
        const res = await fetch(`/api/instructors/${editingInstructor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در بروزرسانی");
        }

        if (form.avatar && form.avatar !== editingInstructor.user.avatar) {
          await fetch("/api/user/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({ avatar: form.avatar, userId: editingInstructor.userId }),
          });
        }

        toast.success("استاد با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/instructors", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در ایجاد استاد");
        }

        if (form.avatar) {
          const created = await res.json();
          await fetch("/api/user/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify({ avatar: form.avatar, userId: form.userId }),
          });
        }

        toast.success("استاد با موفقیت ایجاد شد");
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
      const res = await fetch(`/api/instructors/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در حذف");
      }
      toast.success("استاد با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const filtered = instructors.filter(
    (i) =>
      i.user.name.includes(search) ||
      i.user.email.includes(search) ||
      i.expertise?.includes(search) ||
      i.bio?.includes(search)
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
            placeholder="جستجوی استاد..."
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
          افزودن استاد
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">نام</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">ایمیل</th>
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">خلاصه بیو</th>
                <th className="text-right p-3 font-medium text-outline hidden lg:table-cell">نمایش در سایت</th>
                <th className="text-right p-3 font-medium text-outline hidden lg:table-cell">تاریخ ثبت</th>
                <th className="text-left p-3 font-medium text-outline">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((instructor) => (
                <tr key={instructor.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#eeecfc] flex items-center justify-center overflow-hidden shrink-0">
                        {instructor.user.avatar ? (
                          <img src={instructor.user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#03004b] font-bold text-sm">
                            {instructor.user.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-primary">{instructor.user.name}</div>
                    </div>
                  </td>
                  <td className="p-3 text-outline hidden sm:table-cell">{instructor.user.email}</td>
                  <td className="p-3 text-outline hidden md:table-cell max-w-[200px] truncate">
                    {instructor.bio || "—"}
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    {instructor.showOnSite ? (
                      <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-lg text-xs">
                        <Eye size={12} />
                        فعال
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-outline bg-surface-low px-2 py-0.5 rounded-lg text-xs">
                        <EyeOff size={12} />
                        مخفی
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-outline hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDate(instructor.createdAt)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEditModal(instructor)}
                        className="p-2 rounded-xl text-outline hover:text-[#03004b] hover:bg-[#eeecfc] transition-colors"
                        title="ویرایش"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(instructor)}
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
                    استادی یافت نشد
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
                {editingInstructor ? "ویرایش استاد" : "افزودن استاد جدید"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-outline hover:text-primary p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingInstructor && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">انتخاب کاربر</label>
                  <select
                    required
                    value={form.userId}
                    onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  >
                    <option value="">انتخاب کنید</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-primary mb-2">تصویر پروفایل</label>
                <p className="text-xs text-outline mb-2">سایز توصیه شده: ۳۰۰ × ۳۰۰ پیکسل</p>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setAvatarMode("url")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      avatarMode === "url"
                        ? "bg-[#03004b] text-white"
                        : "bg-surface-variant text-outline"
                    }`}
                  >
                    <Link size={12} />
                    لینک خارجی
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarMode("file")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      avatarMode === "file"
                        ? "bg-[#03004b] text-white"
                        : "bg-surface-variant text-outline"
                    }`}
                  >
                    <Upload size={12} />
                    آپلود فایل
                  </button>
                </div>
                {avatarMode === "url" ? (
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={form.avatar}
                    onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-variant text-sm cursor-pointer hover:bg-surface-low transition-colors">
                      <Upload size={16} className="text-outline" />
                      <span className="text-outline">انتخاب فایل...</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </label>
                  </div>
                )}
                {form.avatar && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={form.avatar}
                      alt="پیش‌نمایش"
                      className="w-10 h-10 rounded-full object-cover border border-surface-variant"
                    />
                    <span className="text-xs text-outline truncate">{form.avatar}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">بیوگرافی</label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">تخصص</label>
                <textarea
                  rows={2}
                  value={form.expertise}
                  onChange={(e) => setForm((p) => ({ ...p, expertise: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">حوزه‌های تخصصی</label>
                <textarea
                  rows={2}
                  value={form.specialties}
                  onChange={(e) => setForm((p) => ({ ...p, specialties: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-variant">
                <div>
                  <label className="text-sm font-medium text-primary">نمایش در سایت</label>
                  <p className="text-xs text-outline mt-0.5">در صورت غیرفعال بودن، استاد در سایت نمایش داده نمی‌شود</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, showOnSite: !p.showOnSite }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    form.showOnSite ? "bg-green-500" : "bg-surface-variant"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      form.showOnSite ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingInstructor ? "بروزرسانی" : "ایجاد استاد"}
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
              <h3 className="text-lg font-bold text-primary mb-2">حذف استاد</h3>
              <p className="text-outline text-sm mb-1">
                آیا از حذف استاد <span className="font-bold text-primary">"{deleteTarget.user.name}"</span> اطمینان دارید؟
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
