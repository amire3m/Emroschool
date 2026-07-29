"use client";

import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, Search, X, Check,
  Calendar, Eye, EyeOff, Upload, Link, ImageIcon, Merge, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

interface Instructor {
  id: string;
  userId: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  expertise: string | null;
  specialties: string | null;
  showOnSite: boolean;
  user: { id: string; name: string; email: string; avatar: string | null } | null;
  createdAt: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
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
    userId: "", name: "", bio: "", expertise: "", specialties: "", showOnSite: true, avatar: "",
  });
  const [manualMode, setManualMode] = useState(false);

  // Merge state
  const [mergeDialog, setMergeDialog] = useState<{ manualInstructor: { name: string; userId?: string }; duplicates: UserData[] } | null>(null);

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
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const instructorUserIds = new Set(instructors.map((i) => i.userId));
  const availableUsers = users.filter((u) => !instructorUserIds.has(u.id));

  const resetForm = () => {
    setForm({ userId: "", name: "", bio: "", expertise: "", specialties: "", showOnSite: true, avatar: "" });
    setEditingInstructor(null);
    setAvatarMode("url");
    setManualMode(false);
    setMergeDialog(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (instructor: Instructor) => {
    setForm({
      userId: instructor.userId || "",
      name: instructor.name || "",
      bio: instructor.bio || "",
      expertise: instructor.expertise || "",
      specialties: instructor.specialties || "",
      showOnSite: instructor.showOnSite,
      avatar: instructor.avatar || instructor.user?.avatar || "",
    });
    setEditingInstructor(instructor);
    setManualMode(!instructor.userId);
    setShowModal(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حداکثر حجم تصویر ۱۰ مگابایت است");
      e.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "خطا در آپلود");
      }
      const data = await res.json();
      setForm((p) => ({ ...p, avatar: data.url }));
      toast.success("تصویر با موفقیت آپلود شد");
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در آپلود تصویر"); }
  };

  // Check for duplicate users when manually entering a name
  const checkDuplicate = (name: string): UserData[] => {
    if (!name.trim()) return [];
    return users.filter((u) => u.name.toLowerCase().includes(name.toLowerCase()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMode && !editingInstructor && !form.userId) {
      toast.error("انتخاب کاربر الزامی است");
      return;
    }
    if (manualMode && !form.name) {
      toast.error("نام استاد الزامی است");
      return;
    }

    // Check for duplicates when in manual mode and creating new
    if (manualMode && !editingInstructor) {
      const duplicates = checkDuplicate(form.name);
      if (duplicates.length > 0) {
        setMergeDialog({
          manualInstructor: { name: form.name },
          duplicates,
        });
        return;
      }
    }

    await saveInstructor();
  };

  const saveInstructor = async (mergeUserId?: string) => {
    setSaving(true);
    const token = getToken();

    const body: Record<string, unknown> = {
      ...(manualMode || mergeUserId ? { name: form.name } : { userId: form.userId }),
      ...(mergeUserId ? { userId: mergeUserId } : {}),
      bio: form.bio || null,
      expertise: form.expertise || null,
      specialties: form.specialties || null,
      avatar: form.avatar || null,
      showOnSite: form.showOnSite,
    };

    try {
      if (editingInstructor) {
        const res = await fetch(`/api/instructors/${editingInstructor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "خطا در بروزرسانی"); }
        toast.success("استاد با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/instructors", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "خطا در ایجاد استاد"); }
        toast.success(mergeUserId ? "استاد ایجاد و به کاربر متصل شد" : "استاد با موفقیت ایجاد شد");
      }
      setShowModal(false);
      setMergeDialog(null);
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
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "خطا در حذف"); }
      toast.success("استاد با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally { setSaving(false); }
  };

  const getInstructorName = (i: Instructor) => i.name || i.user?.name || "";
  const getInstructorEmail = (i: Instructor) => i.user?.email || "";
  const getInstructorAvatar = (i: Instructor) => i.avatar || i.user?.avatar || null;

  const filtered = instructors.filter(
    (i) => getInstructorName(i).includes(search) || getInstructorEmail(i).includes(search) || i.expertise?.includes(search) || i.bio?.includes(search)
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-error gap-2"><AlertCircle size={20} /><span>خطا: {error}</span></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="جستجوی استاد..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={18} /> افزودن استاد
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
                      <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0">
                        {getInstructorAvatar(instructor) ? (
                          <img src={getInstructorAvatar(instructor)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary font-bold text-sm">{getInstructorName(instructor).charAt(0)}</span>
                        )}
                      </div>
                      <div className="font-medium text-primary">{getInstructorName(instructor)}</div>
                    </div>
                  </td>
                  <td className="p-3 text-outline hidden sm:table-cell">{getInstructorEmail(instructor) || "—"}</td>
                  <td className="p-3 text-outline hidden md:table-cell max-w-[200px] truncate">{instructor.bio || "—"}</td>
                  <td className="p-3 hidden lg:table-cell">
                    {instructor.showOnSite ? (
                      <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-lg text-xs"><Eye size={12} /> فعال</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-outline bg-surface-low px-2 py-0.5 rounded-lg text-xs"><EyeOff size={12} /> مخفی</span>
                    )}
                  </td>
                  <td className="p-3 text-outline hidden lg:table-cell">
                    <div className="flex items-center gap-1.5"><Calendar size={13} />{formatDate(instructor.createdAt)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEditModal(instructor)}
                        className="p-2 rounded-xl text-outline hover:text-primary hover:bg-surface-container transition-colors" title="ویرایش"><Pencil size={16} /></button>
                      <button onClick={() => setDeleteTarget(instructor)}
                        className="p-2 rounded-xl text-outline hover:text-error hover:bg-error-container transition-colors" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-outline">استادی یافت نشد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">{editingInstructor ? "ویرایش استاد" : "افزودن استاد جدید"}</h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-primary p-1"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingInstructor && (
                <div className="flex items-center gap-3 mb-3">
                  <button type="button" onClick={() => { setManualMode(false); setForm(p => ({ ...p, userId: "", name: "" })); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${!manualMode ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}>
                    انتخاب کاربر
                  </button>
                  <button type="button" onClick={() => { setManualMode(true); setForm(p => ({ ...p, userId: "", name: "" })); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${manualMode ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}>
                    ورود دستی
                  </button>
                </div>
              )}

              {!editingInstructor && !manualMode && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">انتخاب کاربر</label>
                  <select required={!manualMode} value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed">
                    <option value="">انتخاب کنید</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {(manualMode || editingInstructor?.name) && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">نام استاد</label>
                  <input type="text" required={manualMode} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-primary mb-2">تصویر پروفایل</label>
                <p className="text-xs text-outline mb-2">سایز توصیه شده: ۳۰۰ × ۳۰۰ پیکسل</p>
                <p className="text-xs text-outline mb-2">حداکثر حجم تصویر: ۱۰ مگابایت</p>
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setAvatarMode("url")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${avatarMode === "url" ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}>
                    <Link size={12} /> لینک خارجی
                  </button>
                  <button type="button" onClick={() => setAvatarMode("file")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${avatarMode === "file" ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}>
                    <Upload size={12} /> آپلود فایل
                  </button>
                </div>
                {avatarMode === "url" ? (
                  <input type="text" placeholder="https://example.com/image.jpg" value={form.avatar}
                    onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-variant text-sm cursor-pointer hover:bg-surface-low transition-colors">
                    <Upload size={16} className="text-outline" /> <span className="text-outline">انتخاب فایل...</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                )}
                {form.avatar && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.avatar} alt="پیش‌نمایش" className="w-10 h-10 rounded-full object-cover border border-surface-variant" />
                    <span className="text-xs text-outline truncate">{form.avatar}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">بیوگرافی</label>
                <textarea rows={3} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">تخصص</label>
                <textarea rows={2} value={form.expertise} onChange={(e) => setForm((p) => ({ ...p, expertise: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">حوزه‌های تخصصی</label>
                <textarea rows={2} value={form.specialties} onChange={(e) => setForm((p) => ({ ...p, specialties: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed resize-none" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-variant">
                <div>
                  <label className="text-sm font-medium text-primary">نمایش در سایت</label>
                  <p className="text-xs text-outline mt-0.5">در صورت غیرفعال بودن، استاد در سایت نمایش داده نمی‌شود</p>
                </div>
                <button type="button" onClick={() => setForm((p) => ({ ...p, showOnSite: !p.showOnSite }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.showOnSite ? "bg-green-500" : "bg-surface-variant"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.showOnSite ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingInstructor ? "بروزرسانی" : "ایجاد استاد"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mergeDialog && (
        <div className="modal-overlay" onClick={() => !saving && setMergeDialog(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-secondary-fixed/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-secondary" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">کاربر مشابه یافت شد</h3>
              <p className="text-outline text-sm">
                کاربری با نام مشابه "<span className="font-bold text-primary">{mergeDialog.manualInstructor.name}</span>" وجود دارد.
                آیا می‌خواهید استاد را به این کاربر متصل کنید؟
              </p>
            </div>

            <div className="space-y-2 mb-5">
              {mergeDialog.duplicates.map((dup) => (
                <div key={dup.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-surface-variant hover:bg-surface-low transition-colors cursor-pointer"
                  onClick={() => {
                    saveInstructor(dup.id);
                    setMergeDialog(null);
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-sm">
                      {dup.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-primary">{dup.name}</div>
                      <div className="text-xs text-outline">{dup.email}</div>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    <Merge size={12} /> اتصال
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => { saveInstructor(); setMergeDialog(null); }} disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                ایجاد بدون اتصال
              </button>
              <button onClick={() => setMergeDialog(null)} disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                انصراف
              </button>
            </div>
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
                آیا از حذف استاد <span className="font-bold text-primary">"{getInstructorName(deleteTarget)}"</span> اطمینان دارید؟
              </p>
              <p className="text-outline text-xs">این عمل قابل بازگشت نیست.</p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={handleDelete} disabled={saving}
                  className="flex items-center gap-2 bg-error text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />} حذف
                </button>
                <button onClick={() => setDeleteTarget(null)} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
