"use client";

import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, Search, X,
  Calendar, Eye, EyeOff, Merge, AlertTriangle, ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import Link from "next/link";
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

interface Instructor {
  id: string;
  userId: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  expertise: string | null;
  specialties: string | null;
  profileSlug: string | null;
  showOnSite: boolean;
  user: { id: string; name: string; email: string; avatar: string | null } | null;
  createdAt: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

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

  const [form, setForm] = useState({
    userId: "", name: "", bio: "", expertise: "", specialties: "", profileSlug: "", showOnSite: true, avatar: "",
  });
  const [manualMode, setManualMode] = useState(false);
  const [specialtyInput, setSpecialtyInput] = useState("");

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
    setForm({ userId: "", name: "", bio: "", expertise: "", specialties: "", profileSlug: "", showOnSite: true, avatar: "" });
    setEditingInstructor(null);
    setManualMode(false);
    setSpecialtyInput("");
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
      profileSlug: instructor.profileSlug || "",
      showOnSite: instructor.showOnSite,
      avatar: instructor.avatar || instructor.user?.avatar || "",
    });
    setEditingInstructor(instructor);
    setManualMode(!instructor.userId);
    setSpecialtyInput("");
    setShowModal(true);
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
      profileSlug: form.profileSlug.trim().toLowerCase() || null,
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
  const specialties = form.specialties.split(",").map((item) => item.trim().replace(/^#/, "")).filter(Boolean);
  const addSpecialty = () => {
    const value = specialtyInput.trim().replace(/^#/, "");
    if (!value || specialties.includes(value)) { setSpecialtyInput(""); return; }
    setForm((form) => ({ ...form, specialties: [...specialties, value].join(", ") }));
    setSpecialtyInput("");
  };

  const filtered = instructors.filter(
    (i) => getInstructorName(i).includes(search) || getInstructorEmail(i).includes(search) || i.expertise?.includes(search) || i.bio?.includes(search)
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#03004b]" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600 gap-2"><AlertCircle size={20} /><span>خطا: {error}</span></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت استادان"
        subtitle={`${instructors.length.toLocaleString("fa-IR")} استاد ثبت‌شده`}
        actions={
          <PrimaryButton onClick={openCreateModal}>
            <Plus size={15} />افزودن استاد
          </PrimaryButton>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <SearchInput type="text" placeholder="جستجوی استاد..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <DataTable
        minWidth={760}
        head={
          <>
            <Th>نام</Th>
            <Th className="hidden sm:table-cell">ایمیل</Th>
            <Th className="hidden md:table-cell">خلاصه بیو</Th>
            <Th center className="hidden lg:table-cell">نمایش در سایت</Th>
            <Th className="hidden lg:table-cell">تاریخ ثبت</Th>
            <Th>عملیات</Th>
          </>
        }
      >
        {filtered.map((instructor) => (
          <tr key={instructor.id} className="border-t border-slate-100 transition first:border-t-0 hover:bg-slate-50/60">
            <Td>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {getInstructorAvatar(instructor) ? (
                    <img src={getInstructorAvatar(instructor)!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-slate-600">{getInstructorName(instructor).charAt(0)}</span>
                  )}
                </div>
                <div className="font-medium text-slate-900">{getInstructorName(instructor)}</div>
              </div>
            </Td>
            <Td className="hidden text-slate-500 sm:table-cell">{getInstructorEmail(instructor) || "—"}</Td>
            <Td className="hidden max-w-[200px] truncate text-slate-500 md:table-cell">{instructor.bio || "—"}</Td>
            <Td className="hidden text-center lg:table-cell">
              {instructor.showOnSite ? (
                <Badge tone="emerald"><Eye size={12} />فعال</Badge>
              ) : (
                <Badge tone="slate"><EyeOff size={12} />مخفی</Badge>
              )}
            </Td>
            <Td className="hidden text-slate-500 lg:table-cell">
              <div className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" /><span className="tabular-nums">{formatDate(instructor.createdAt)}</span></div>
            </Td>
            <Td>
              <div className="flex items-center gap-2 justify-end">
                <Link href={`/instructors/${instructor.profileSlug || instructor.id}`} target="_blank"
                  className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="مشاهده پروفایل"><ExternalLink size={16} /></Link>
                <button type="button" onClick={() => openEditModal(instructor)}
                  className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="ویرایش"><Pencil size={16} /></button>
                <button type="button" onClick={() => setDeleteTarget(instructor)}
                  className={`rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 ${FOCUS_VISIBLE}`} title="حذف"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr><Td colSpan={6}><EmptyState message="استادی یافت نشد" /></Td></tr>
        )}
      </DataTable>

      {showModal && (
        <Modal
          title={editingInstructor ? "ویرایش استاد" : "افزودن استاد جدید"}
          onClose={() => { if (!saving) setShowModal(false); }}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingInstructor && (
              <div className="flex items-center gap-3 mb-3">
                <button type="button" onClick={() => { setManualMode(false); setForm(p => ({ ...p, userId: "", name: "" })); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${FOCUS_VISIBLE} ${!manualMode ? "bg-[#03004b] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  انتخاب کاربر
                </button>
                <button type="button" onClick={() => { setManualMode(true); setForm(p => ({ ...p, userId: "", name: "" })); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${FOCUS_VISIBLE} ${manualMode ? "bg-[#03004b] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  ورود دستی
                </button>
              </div>
            )}

            {!editingInstructor && !manualMode && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">انتخاب کاربر</label>
                <select required={!manualMode} value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                  className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}>
                  <option value="">انتخاب کنید</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
            )}

            {(manualMode || editingInstructor?.name) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">نام استاد</label>
                <input type="text" required={manualMode} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`} />
              </div>
            )}

            <ImageUpload value={form.avatar} onChange={(url) => setForm((previous) => ({ ...previous, avatar: url }))} label="تصویر پروفایل" sizeHint="۶۰۰ × ۶۰۰ پیکسل" aspectRatio="1:1" />

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">آدرس صفحه استاد</label>
              <div className="flex overflow-hidden rounded-lg border border-slate-200"><input type="text" dir="ltr" value={form.profileSlug} onChange={(e) => setForm((p) => ({ ...p, profileSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="javad-gharaei" className="min-w-0 flex-1 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none" /><span className="bg-slate-50 px-3 py-2.5 text-xs text-slate-500" dir="ltr">/instructors/</span></div>
              <p className="mt-1 text-xs text-slate-500">اختیاری؛ حروف انگلیسی کوچک، عدد و خط تیره. در صورت خالی‌بودن، آدرس پیش‌فرض استفاده می‌شود.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">بیوگرافی</label>
              <textarea rows={3} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                className={`w-full resize-none ${INPUT_CLASS}`} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">سمت</label>
              <textarea rows={2} value={form.expertise} onChange={(e) => setForm((p) => ({ ...p, expertise: e.target.value }))}
                className={`w-full resize-none ${INPUT_CLASS}`} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">حوزه تخصصی</label>
              <div className="rounded-lg border border-slate-200 bg-white p-2 focus-within:border-[#03004b] focus-within:ring-2 focus-within:ring-[#03004b]/15">
                <div className="flex flex-wrap gap-2">{specialties.map((specialty) => <span key={specialty} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700">#{specialty}<button type="button" onClick={() => setForm((form) => ({ ...form, specialties: specialties.filter((item) => item !== specialty).join(", ") }))} className={`rounded p-0.5 hover:bg-white ${FOCUS_VISIBLE}`} title={`حذف ${specialty}`}><X size={13} /></button></span>)}</div>
                <input value={specialtyInput} onChange={(event) => setSpecialtyInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSpecialty(); } }} onBlur={addSpecialty} placeholder={specialties.length ? "حوزه تخصصی دیگر را وارد کنید..." : "حوزه تخصصی را وارد کنید و Enter بزنید"} className="mt-1 w-full bg-transparent px-1 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400" />
              </div>
              <p className="mt-1 text-xs text-slate-500">پس از هر حوزه، Enter بزنید.</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <label className="text-sm font-medium text-slate-900">نمایش در سایت</label>
                <p className="mt-0.5 text-xs text-slate-500">در صورت غیرفعال بودن، استاد در سایت نمایش داده نمی‌شود</p>
              </div>
              <button type="button" onClick={() => setForm((p) => ({ ...p, showOnSite: !p.showOnSite }))}
                className={`relative h-6 w-12 rounded-full transition-colors ${FOCUS_VISIBLE} ${form.showOnSite ? "bg-emerald-500" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.showOnSite ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingInstructor ? "بروزرسانی" : "ایجاد استاد"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowModal(false)} disabled={saving}>انصراف</SecondaryButton>
            </div>
          </form>
        </Modal>
      )}

      {mergeDialog && (
        <Modal
          title="کاربر مشابه یافت شد"
          onClose={() => { if (!saving) setMergeDialog(null); }}
          maxWidth="max-w-md"
          footer={
            <>
              <SecondaryButton onClick={() => { saveInstructor(); setMergeDialog(null); }} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                ایجاد بدون اتصال
              </SecondaryButton>
              <PrimaryButton onClick={() => setMergeDialog(null)} disabled={saving}>
                انصراف
              </PrimaryButton>
            </>
          }
        >
          <div className="mb-5 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
              <AlertTriangle size={28} className="text-amber-600" />
            </div>
            <p className="text-sm text-slate-500">
              کاربری با نام مشابه "<span className="font-bold text-slate-900">{mergeDialog.manualInstructor.name}</span>" وجود دارد.
              آیا می‌خواهید استاد را به این کاربر متصل کنید؟
            </p>
          </div>

          <div className="space-y-2">
            {mergeDialog.duplicates.map((dup) => (
              <div key={dup.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
                onClick={() => {
                  saveInstructor(dup.id);
                  setMergeDialog(null);
                }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {dup.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{dup.name}</div>
                    <div className="text-xs text-slate-500">{dup.email}</div>
                  </div>
                </div>
                <button type="button" className={`flex items-center gap-1 rounded-lg bg-[#03004b] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#1b1c5e] ${FOCUS_VISIBLE}`}>
                  <Merge size={12} /> اتصال
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="حذف استاد"
          onClose={() => { if (!saving) setDeleteTarget(null); }}
          maxWidth="max-w-md"
          footer={
            <>
              <DangerButton onClick={handleDelete} disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />} حذف
              </DangerButton>
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>انصراف</SecondaryButton>
            </>
          }
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <p className="text-sm text-slate-500">
              آیا از حذف استاد <span className="font-bold text-slate-900">"{getInstructorName(deleteTarget)}"</span> اطمینان دارید؟
            </p>
            <p className="mt-1 text-xs text-slate-500">این عمل قابل بازگشت نیست.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
