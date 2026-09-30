"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, AlertCircle, UserCog, User, Calendar, GraduationCap, Pencil, Save, Plus, Check, LogIn, Trash2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie, setCookie } from "@/lib/cookie";
import {
  PageHeader,
  StatCard,
  DataTable,
  Th,
  Td,
  Badge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  SearchInput,
  FilterChips,
  Modal,
} from "@/components/admin/ui";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  permissions: string | null;
  profileVisible: boolean;
  profileApprovalStatus: string;
  profileReviewedAt: string | null;
  createdAt: string;
  enrollmentCount: number;
  avatar: string | null; phone: string | null; balePhone: string | null; nationalCode: string | null; emailVerified: boolean; phoneVerified: boolean; bio: string | null; expertise: string | null; socialLinks: string | null; birthDate: string | null; gender: string | null; province: string | null; city: string | null; district: string | null; neighborhood: string | null; address: string | null; postalCode: string | null; educationLevel: string | null; educationField: string | null; university: string | null; universityField: string | null; workHistory: string | null; artHistory: string | null; instagramId: string | null; virtualPhone: string | null; landline: string | null; newsletterSubscribed: boolean; notificationEmailEnabled: boolean; notificationSmsEnabled: boolean; notificationBaleEnabled: boolean; profileRejectionReason?: string | null; avatarSubmissions?: Array<{ id: string; imageUrl: string; status: string; rejectionReason?: string | null; submittedAt: string }>; enrollments?: Array<{ id: string; createdAt: string; progress: number; completed: boolean; course: { id: string; title: string } }>; courseApplications?: Array<{ id: string; status: string; createdAt: string; discountCode: string | null; discountLabel: string | null; discountPercent: number; finalAmountTomans: number; course: { id: string; title: string } }>;
}

const userTypeLabels: Record<string, string> = {
  student: "دانشجو",
  instructor: "مدرس",
  alumni: "فارغ‌التحصیل",
  admin: "مدیر",
};

const roleLabels: Record<string, string> = {
  superadmin: "مدیر ارشد",
  admin: "ادمین",
  user: "کاربر",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function AdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [profileFilter, setProfileFilter] = useState<"all" | "pending">("all");
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>({ role: "", userType: "", permissions: "", profileVisible: true, password: "" });
  const [editTab, setEditTab] = useState<"identity" | "contact" | "profile" | "courses" | "access">("identity");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", userType: "student" });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [profileReviewUser, setProfileReviewUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; scheduleStatus: string }>>([]);
  const [manualCourseId, setManualCourseId] = useState("");

  const getToken = () => getCookie("token") || "";

  const fetchUsers = () => {
    const token = getToken();
    if (!token) return;
    fetch("/api/users", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { fetch("/api/courses", { headers: { authorization: `Bearer ${getToken()}` } }).then((response) => response.json()).then((data) => setCourses(data.courses || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") === "instructor") {
      setCreateForm((form) => ({ ...form, userType: "instructor" }));
      setShowCreate(true);
    }
  }, []);

  const createUser = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${getToken()}` }, body: JSON.stringify(createForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ایجاد کاربر");
      toast.success(createForm.userType === "instructor" ? "کاربر مدرس و پروفایل استاد ایجاد شد" : "کاربر ایجاد شد");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", userType: "student" });
      fetchUsers();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا در ایجاد کاربر"); }
    finally { setSaving(false); }
  };

  const openEdit = (user: UserData) => {
    setEditUser(user);
    setEditForm({
      role: user.role,
      userType: user.userType,
      permissions: user.permissions || "",
      profileVisible: user.profileVisible,
      password: "",
      name: user.name, email: user.email, phone: user.phone || "", balePhone: user.balePhone || "", nationalCode: user.nationalCode || "", birthDate: user.birthDate || "", gender: user.gender || "", province: user.province || "", city: user.city || "", district: user.district || "", neighborhood: user.neighborhood || "", address: user.address || "", postalCode: user.postalCode || "", educationLevel: user.educationLevel || "", educationField: user.educationField || "", university: user.university || "", universityField: user.universityField || "", workHistory: user.workHistory || "", artHistory: user.artHistory || "", instagramId: user.instagramId || "", virtualPhone: user.virtualPhone || "", landline: user.landline || "", bio: user.bio || "", expertise: user.expertise || "", socialLinks: user.socialLinks || "", newsletterSubscribed: user.newsletterSubscribed, notificationEmailEnabled: user.notificationEmailEnabled, notificationSmsEnabled: user.notificationSmsEnabled, notificationBaleEnabled: user.notificationBaleEnabled,
    });
    setEditTab("identity");
    setManualCourseId("");
  };
  const textField = (field: string, label: string, type = "text") => { const autocomplete: Record<string, string> = { name: "name", email: "email", phone: "tel", balePhone: "tel", landline: "tel", virtualPhone: "tel", postalCode: "postal-code", address: "street-address", province: "address-level1", city: "address-level2" }; return <div><label className="mb-1 block text-sm font-medium text-slate-900">{label}</label><input type={type} name={field} autoComplete={autocomplete[field] || "off"} value={String(editForm[field] || "")} onChange={(event) => setEditForm((form) => ({ ...form, [field]: event.target.value }))} className={`w-full ${INPUT_CLASS}`} /></div>; };
  const toggleField = (field: string, label: string, hint: string) => <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3"><span><span className="block text-sm font-medium text-slate-900">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{hint}</span></span><input type="checkbox" checked={Boolean(editForm[field])} onChange={(event) => setEditForm((form) => ({ ...form, [field]: event.target.checked }))} className="h-4 w-4 accent-[#03004b]" /></label>;

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const token = getToken();
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در بروزرسانی");
      }
      toast.success("کاربر بروزرسانی شد");
      setEditUser(null);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };
  const addManualEnrollment = async () => {
    if (!editUser || !manualCourseId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${editUser.id}/enroll`, { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ courseId: manualCourseId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "افزودن دوره ناموفق بود");
      setEditUser((current) => current ? { ...current, enrollmentCount: current.enrollmentCount + 1, enrollments: [{ ...data.enrollment, createdAt: data.enrollment.createdAt, progress: 0, completed: false }, ...(current.enrollments || [])] } : current);
      setManualCourseId("");
      toast.success("دوره به‌صورت دستی برای کاربر ثبت شد");
      fetchUsers();
    } catch (error) { toast.error(error instanceof Error ? error.message : "افزودن دوره ناموفق بود"); }
    finally { setSaving(false); }
  };

  const reviewProfile = async (user: UserData, status: "approved" | "rejected" | "pending") => {
    const rejectionReason = status === "rejected" ? window.prompt("دلیل رد پروفایل را برای کاربر بنویسید:")?.trim() : "";
    if (status === "rejected" && !rejectionReason) return;
    setReviewingId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/profile-review`, { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ status, rejectionReason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "بررسی پروفایل انجام نشد");
      toast.success(status === "approved" ? "پروفایل تایید شد" : status === "rejected" ? "درخواست پروفایل رد شد" : "پروفایل به انتظار بررسی بازگردانده شد");
      fetchUsers();
    } catch (err) { toast.error(err instanceof Error ? err.message : "بررسی پروفایل انجام نشد"); }
    finally { setReviewingId(null); }
  };
  const reviewAvatar = async (user: UserData, status: "approved" | "rejected") => {
    const submission = user.avatarSubmissions?.[0];
    if (!submission) return;
    const rejectionReason = status === "rejected" ? window.prompt("دلیل رد تصویر را برای کاربر بنویسید:")?.trim() : "";
    if (status === "rejected" && !rejectionReason) return;
    setReviewingId(user.id);
    try {
      const response = await fetch(`/api/admin/avatar-submissions/${submission.id}`, { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ status, rejectionReason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "بررسی تصویر انجام نشد");
      toast.success(status === "approved" ? "تصویر پروفایل تایید شد" : "تصویر پروفایل رد شد");
      fetchUsers();
    } catch (err) { toast.error(err instanceof Error ? err.message : "بررسی تصویر انجام نشد"); }
    finally { setReviewingId(null); }
  };

  const impersonate = async (user: UserData) => {
    if (user.role !== "user" || !confirm(`ورود به حساب ${user.name} انجام شود؟`)) return;
    setImpersonatingId(user.id);
    try {
      const currentToken = getToken();
      const response = await fetch(`/api/admin/users/${user.id}/impersonate`, { method: "POST", headers: { authorization: `Bearer ${currentToken}` } });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.error || "ورود به حساب کاربر انجام نشد");
      sessionStorage.setItem("impersonator-token", currentToken);
      setCookie("token", data.token);
      window.dispatchEvent(new Event("auth-changed"));
      router.push("/dashboard");
    } catch (err) { toast.error(err instanceof Error ? err.message : "ورود به حساب کاربر انجام نشد"); }
    finally { setImpersonatingId(null); }
  };
  const deleteUser = async (user: UserData) => { if (!confirm(`حذف دائمی کاربر «${user.name}» و اطلاعات وابسته او انجام شود؟`)) return; setSaving(true); try { const response = await fetch(`/api/users/${user.id}`, { method: "DELETE", headers: { authorization: `Bearer ${getToken()}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "حذف کاربر انجام نشد"); toast.success("کاربر حذف شد"); fetchUsers(); } catch (err) { toast.error(err instanceof Error ? err.message : "حذف کاربر انجام نشد"); } finally { setSaving(false); } };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.includes(search) || u.email.includes(search) || u.role.includes(search);
    const matchType = filterType === "all" || u.userType === filterType;
    const matchProfile = profileFilter === "all" || u.profileApprovalStatus === "pending";
    return matchSearch && matchType && matchProfile;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#03004b]" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600 gap-2"><AlertCircle size={20} /><span>خطا: {error}</span></div>;
  }

  const pendingCount = users.filter((user) => user.profileApprovalStatus === "pending").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت کاربران"
        subtitle={`${users.length.toLocaleString("fa-IR")} کاربر ثبت‌شده`}
        actions={
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus size={15} />ایجاد کاربر
          </PrimaryButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="مجموع کاربران" value={users.length.toLocaleString("fa-IR")} icon={User} tone="bg-blue-50 text-blue-600" />
        <StatCard label="درخواست‌های پروفایل" value={pendingCount.toLocaleString("fa-IR")} icon={Eye} tone="bg-amber-50 text-amber-600" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <SearchInput type="text" placeholder="جستجوی کاربر..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className={`${INPUT_CLASS} ${FOCUS_VISIBLE} sm:w-40`}>
              <option value="all">همه</option>
              <option value="student">دانشجو</option>
              <option value="instructor">مدرس</option>
              <option value="alumni">فارغ‌التحصیل</option>
              <option value="admin">مدیر</option>
            </select>
          </div>
          <FilterChips
            options={[
              { value: "all" as const, label: "همه کاربران" },
              { value: "pending" as const, label: `درخواست‌های پروفایل (${pendingCount.toLocaleString("fa-IR")})` },
            ]}
            value={profileFilter}
            onChange={(v) => setProfileFilter(v)}
          />
        </div>
      </div>

      <DataTable
        minWidth={760}
        head={
          <>
            <Th>نام</Th>
            <Th className="hidden sm:table-cell">ایمیل</Th>
            <Th center>نقش</Th>
            <Th center className="hidden md:table-cell">نوع کاربر</Th>
            <Th center className="hidden lg:table-cell">پروفایل</Th>
            <Th className="hidden md:table-cell">تاریخ ثبت‌نام</Th>
            <Th center className="hidden lg:table-cell">دوره‌ها</Th>
            <Th>عملیات</Th>
          </>
        }
      >
        {filtered.map((user) => (
          <tr key={user.id} className="border-t border-slate-100 transition first:border-t-0 hover:bg-slate-50/60">
            <Td>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{user.name}</div>
                  <div className="text-xs text-slate-500 sm:hidden">{user.email}</div>
                </div>
              </div>
            </Td>
            <Td className="hidden text-slate-500 sm:table-cell">{user.email}</Td>
            <Td className="text-center">
              <Badge tone={user.role === "admin" || user.role === "superadmin" ? "navy" : "slate"}>
                {user.role === "admin" || user.role === "superadmin" ? <UserCog size={12} /> : <User size={12} />}
                {roleLabels[user.role] || user.role}
              </Badge>
            </Td>
            <Td className="hidden text-center md:table-cell">
              <Badge tone="slate">
                {userTypeLabels[user.userType] || user.userType}
              </Badge>
            </Td>
            <Td className="hidden text-center lg:table-cell">
              <Badge tone={user.profileApprovalStatus === "approved" ? "emerald" : user.profileApprovalStatus === "rejected" ? "red" : "amber"}>
                {user.profileApprovalStatus === "approved" ? "تایید شده" : user.profileApprovalStatus === "rejected" ? "رد شده" : "در انتظار"}
              </Badge>
            </Td>
            <Td className="hidden text-slate-500 md:table-cell">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span className="tabular-nums">{formatDate(user.createdAt)}</span>
              </div>
            </Td>
            <Td className="hidden text-center lg:table-cell">
              <div className="flex items-center justify-center gap-1.5">
                <GraduationCap size={14} className="text-slate-400" />
                <span className="font-medium tabular-nums text-slate-900">{user.enrollmentCount.toLocaleString("fa-IR")}</span>
              </div>
            </Td>
            <Td>
              <div className="flex items-center gap-2 justify-end">
                <PrimaryButton onClick={() => setProfileReviewUser(user)} title="مشاهده و بررسی پروفایل" className="px-2 py-1 text-xs">
                  <Eye size={14} /><span className="hidden xl:inline">{user.profileApprovalStatus === "pending" || user.avatarSubmissions?.[0]?.status === "pending" ? "بررسی" : "وضعیت"}</span>
                </PrimaryButton>
                {user.role === "user" && (
                  <SecondaryButton onClick={() => impersonate(user)} disabled={impersonatingId === user.id} title="ورود به حساب کاربر" className="px-2 py-1 text-xs">
                    {impersonatingId === user.id ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}<span className="hidden xl:inline">ورود به حساب</span>
                  </SecondaryButton>
                )}
                <button type="button" onClick={() => openEdit(user)}
                  className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="ویرایش">
                  <Pencil size={16} />
                </button>
                <button type="button" onClick={() => deleteUser(user)} disabled={saving} className={`rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${FOCUS_VISIBLE}`} title="حذف کاربر"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr><Td colSpan={8}><EmptyState message="کاربری یافت نشد" /></Td></tr>
        )}
      </DataTable>

      {editUser && (
        <Modal
          title={`ویرایش کاربر: ${editUser.name}`}
          onClose={() => { if (!saving) setEditUser(null); }}
          maxWidth="max-w-3xl"
          footer={
            <>
              <PrimaryButton onClick={saveEdit} disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                <Save size={16} /> بروزرسانی
              </PrimaryButton>
              <SecondaryButton onClick={() => setEditUser(null)} disabled={saving}>
                انصراف
              </SecondaryButton>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{[["identity", "هویت و تحصیل"], ["contact", "تماس و نشانی"], ["profile", "پروفایل و اعلان"], ["courses", "دوره‌ها و تخفیف"], ["access", "دسترسی و امنیت"]].map(([tab, label]) => <button key={tab} type="button" onClick={() => setEditTab(tab as typeof editTab)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${FOCUS_VISIBLE} ${editTab === tab ? "bg-[#03004b] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div>
            {editTab === "identity" && <div className="grid gap-3 sm:grid-cols-2">{textField("name", "نام و نام خانوادگی")}{textField("email", "ایمیل", "email")}<p className="sm:col-span-2 text-xs text-slate-500">ایمیل ثبت‌شده توسط مدیر، تاییدشده محسوب می‌شود.</p>{textField("nationalCode", "کد ملی")}{textField("birthDate", "تاریخ تولد")}{textField("gender", "جنسیت")}{textField("educationLevel", "مقطع تحصیلی")}{textField("educationField", "رشته تحصیلی")}{textField("university", "دانشگاه")}{textField("universityField", "رشته دانشگاهی")}{textField("workHistory", "سابقه کاری")}{textField("artHistory", "سابقه هنری")}</div>}
            {editTab === "contact" && <div className="grid gap-3 sm:grid-cols-2">{textField("phone", "شماره موبایل")}{textField("balePhone", "شماره بله")}{textField("landline", "تلفن ثابت")}{textField("virtualPhone", "تلفن مجازی")}{textField("province", "استان")}{textField("city", "شهر")}{textField("district", "منطقه")}{textField("neighborhood", "محله")}{textField("postalCode", "کدپستی")}{textField("address", "نشانی")}</div>}
            {editTab === "profile" && <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{textField("expertise", "تخصص")}{textField("instagramId", "شناسه اینستاگرام")}</div>{textField("bio", "معرفی")}{textField("socialLinks", "لینک‌های اجتماعی")}<div className="grid gap-3 sm:grid-cols-2">{toggleField("newsletterSubscribed", "خبرنامه", "دریافت خبرنامه")}{toggleField("notificationEmailEnabled", "اعلان ایمیلی", "ارسال اعلان به ایمیل")}{toggleField("notificationSmsEnabled", "اعلان پیامکی", "ارسال اعلان پیامکی")}{toggleField("notificationBaleEnabled", "اعلان بله", "ارسال اعلان در بله")}</div></div>}
            {editTab === "courses" && (
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black text-slate-900">افزودن دستی دوره</h4>
                  <p className="mt-1 text-xs leading-6 text-slate-500">این عمل کاربر را بدون ایجاد پرداخت یا درخواست ثبت‌نام در دوره انتخاب‌شده ثبت می‌کند.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select value={manualCourseId} onChange={(event) => setManualCourseId(event.target.value)} className={`min-w-0 flex-1 ${INPUT_CLASS} ${FOCUS_VISIBLE}`}>
                      <option value="">انتخاب دوره</option>
                      {courses.filter((course) => !editUser.enrollments?.some((enrollment) => enrollment.course.id === course.id)).map((course) => <option key={course.id} value={course.id}>{course.title}{course.scheduleStatus === "completed" ? " (برگزارشده)" : ""}</option>)}
                    </select>
                    <PrimaryButton disabled={saving || !manualCourseId} onClick={addManualEnrollment}>افزودن دوره</PrimaryButton>
                  </div>
                </section>
                <section>
                  <h4 className="text-sm font-black text-slate-900">دوره‌های ثبت‌شده</h4>
                  <div className="mt-2 space-y-2">
                    {editUser.enrollments?.map((enrollment) => (
                      <div key={enrollment.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="font-bold text-slate-900">{enrollment.course.title}</p>
                        <p className="mt-1 text-xs tabular-nums text-slate-500">ثبت در دوره: {new Date(enrollment.createdAt).toLocaleDateString("fa-IR")} · پیشرفت: {enrollment.progress.toLocaleString("fa-IR")}٪ {enrollment.completed ? "· تکمیل‌شده" : ""}</p>
                      </div>
                    ))}
                    {!editUser.enrollments?.length && <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">کاربر هنوز در دوره‌ای ثبت نشده است.</p>}
                  </div>
                </section>
                <section>
                  <h4 className="text-sm font-black text-slate-900">درخواست‌های ثبت‌نام و کد تخفیف</h4>
                  <div className="mt-2 space-y-2">
                    {editUser.courseApplications?.map((application) => (
                      <div key={application.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-slate-900">{application.course.title}</p>
                          <Badge tone={application.status === "approved" ? "emerald" : application.status === "rejected" ? "red" : "amber"}>
                            {application.status === "approved" ? "تایید شده" : application.status === "rejected" ? "رد شده" : "در انتظار بررسی"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-slate-500">{new Date(application.createdAt).toLocaleDateString("fa-IR")}</p>
                        {application.discountCode ? <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-bold tabular-nums text-slate-700">کد تخفیف: {application.discountCode}{application.discountLabel ? ` · ${application.discountLabel}` : ""} · {application.discountPercent.toLocaleString("fa-IR")}٪ · مبلغ نهایی: {application.finalAmountTomans.toLocaleString("fa-IR")} تومان</p> : <p className="mt-2 text-xs text-slate-500">بدون کد تخفیف</p>}
                      </div>
                    ))}
                    {!editUser.courseApplications?.length && <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">درخواست ثبت‌نامی وجود ندارد.</p>}
                  </div>
                </section>
              </div>
            )}
            {editTab === "access" && <>
            <div><label className="block text-sm font-medium text-slate-900 mb-1">جایگاه اصلی</label><select value={String(editForm.userType)} onChange={(e) => setEditForm(p => ({ ...p, userType: e.target.value }))} className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}><option value="student">دانشجو</option><option value="instructor">مدرس</option><option value="alumni">فارغ‌التحصیل</option></select><p className="mt-1 text-xs text-slate-500">جایگاه آموزشی و نمایشی حساب، مستقل از دسترسی به پنل مدیریت است.</p></div>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><span><span className="block text-sm font-bold text-slate-900">دسترسی مدیریتی دارد</span><span className="mt-1 block text-xs text-slate-500">با فعال‌کردن، سطح دسترسی و مجوزهای پنل مدیریت قابل تنظیم است.</span></span><input type="checkbox" checked={editForm.role !== "user"} onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.checked ? "admin" : "user", permissions: event.target.checked ? form.permissions : "" }))} className="h-5 w-5 accent-[#03004b]" /></label>
            {editForm.role !== "user" && <>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">سطح دسترسی مدیریتی</label>
              <select value={String(editForm.role)} onChange={(e) => setEditForm(p => ({ ...p, role: e.target.value }))}
                className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}>
                <option value="user">کاربر</option>
                <option value="admin">ادمین</option>
                <option value="superadmin">مدیر ارشد</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">دسترسی‌ها (JSON Array)</label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3">{[["courses", "دوره‌ها"], ["applications", "ثبت‌نام‌ها"], ["events", "رویدادها"], ["news", "اخبار"], ["instructors", "مدرس‌ها"], ["gallery", "گالری"], ["files", "فایل‌ها"], ["notifications", "اعلان‌ها"], ["users", "کاربران"], ["settings", "تنظیمات"], ["payments", "پرداخت‌ها"], ["discounts", "تخفیف"], ["support", "پشتیبانی"], ["impersonate", "ورود به حساب"]].map(([value, label]) => { let selected: string[] = []; try { selected = JSON.parse(String(editForm.permissions || "[]")); } catch {} return <label key={value} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={selected.includes(value)} onChange={(event) => setEditForm((form) => ({ ...form, permissions: JSON.stringify(event.target.checked ? [...selected, value] : selected.filter((item) => item !== value)) }))} className="accent-[#03004b]" />{label}</label>; })}</div>
            </div></>}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
              <div>
                <label className="text-sm font-medium text-slate-900">پروفایل عمومی</label>
                <p className="text-xs text-slate-500 mt-0.5">در صورت فعال بودن، دیگران می‌توانند پروفایل کاربر را ببینند</p>
              </div>
              <button type="button" onClick={() => setEditForm(p => ({ ...p, profileVisible: !p.profileVisible }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${FOCUS_VISIBLE} ${editForm.profileVisible ? "bg-emerald-500" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editForm.profileVisible ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div><label className="block text-sm font-medium text-slate-900 mb-1">رمز عبور جدید</label><input type="password" name="newPassword" autoComplete="new-password" value={String(editForm.password)} onChange={(e) => setEditForm((current) => ({ ...current, password: e.target.value }))} minLength={6} placeholder="برای حفظ رمز فعلی خالی بگذارید" className={`w-full ${INPUT_CLASS}`} /><p className="text-xs text-slate-500 mt-1">حداقل ۶ کاراکتر؛ مدیر می‌تواند برای کاربر رمز جدید تعیین کند.</p></div></>}
          </div>
        </Modal>
      )}
      {profileReviewUser && (
        <Modal
          title={`بررسی پروفایل: ${profileReviewUser.name}`}
          subtitle={`${profileReviewUser.email}${profileReviewUser.phone ? ` · ${profileReviewUser.phone}` : ""}`}
          onClose={() => { if (!reviewingId) setProfileReviewUser(null); }}
          maxWidth="max-w-3xl"
          footer={
            <>
              {profileReviewUser.profileApprovalStatus === "pending" ? (
                <>
                  <PrimaryButton onClick={async () => { await reviewProfile(profileReviewUser, "approved"); setProfileReviewUser(null); }} disabled={reviewingId === profileReviewUser.id}><Check size={16} />تایید پروفایل</PrimaryButton>
                  <DangerButton onClick={async () => { await reviewProfile(profileReviewUser, "rejected"); setProfileReviewUser(null); }} disabled={reviewingId === profileReviewUser.id}>رد پروفایل</DangerButton>
                </>
              ) : (
                <SecondaryButton onClick={async () => { await reviewProfile(profileReviewUser, "pending"); setProfileReviewUser(null); }} disabled={reviewingId === profileReviewUser.id}>بازگرداندن به انتظار بررسی</SecondaryButton>
              )}
            </>
          }
        >
          <div className="mb-5 flex items-center gap-3">
            {profileReviewUser.avatar ? (
              <img src={profileReviewUser.avatar} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-xl font-black text-slate-600">{profileReviewUser.name.charAt(0)}</span>
            )}
            <div>
              <p className="text-xs font-bold text-slate-500">بررسی پروفایل عمومی</p>
              <p className="mt-1 text-base font-black tabular-nums text-slate-900">{profileReviewUser.name}</p>
            </div>
          </div>
          {profileReviewUser.avatarSubmissions?.[0]?.status === "pending" && (
            <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-900">بررسی تصویر پروفایل</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                <img src={profileReviewUser.avatarSubmissions[0].imageUrl} alt="تصویر پیشنهادی پروفایل" className="h-28 w-28 rounded-xl object-cover" />
                <div className="flex-1">
                  <p className="text-xs leading-6 text-slate-500">تایید تصویر، آن را در پروفایل عمومی نمایش می‌دهد. رد تصویر، پروفایل را رد نمی‌کند.</p>
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton onClick={() => reviewAvatar(profileReviewUser, "approved")} disabled={reviewingId === profileReviewUser.id} className="px-4 py-2 text-xs">تایید تصویر</PrimaryButton>
                    <DangerButton onClick={() => reviewAvatar(profileReviewUser, "rejected")} disabled={reviewingId === profileReviewUser.id} className="px-4 py-2 text-xs">رد تصویر</DangerButton>
                  </div>
                </div>
              </div>
            </section>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {[["معرفی", profileReviewUser.bio], ["تخصص", profileReviewUser.expertise], ["استان و شهر", [profileReviewUser.province, profileReviewUser.city, profileReviewUser.district, profileReviewUser.neighborhood].filter(Boolean).join("، ")], ["تاریخ تولد و جنسیت", [profileReviewUser.birthDate ? new Date(profileReviewUser.birthDate).toLocaleDateString("fa-IR") : "", profileReviewUser.gender === "male" ? "مرد" : profileReviewUser.gender === "female" ? "زن" : ""].filter(Boolean).join("، ")], ["تحصیلات", [profileReviewUser.educationLevel, profileReviewUser.educationField, profileReviewUser.university, profileReviewUser.universityField].filter(Boolean).join("، ")], ["اینستاگرام", profileReviewUser.instagramId], ["سوابق کاری", profileReviewUser.workHistory], ["سوابق هنری و فرهنگی", profileReviewUser.artHistory], ["شبکه‌های اجتماعی", profileReviewUser.socialLinks]].filter(([, value]) => value).map(([label, value]) => (
              <div key={String(label)} className={`rounded-xl border border-slate-200 bg-white p-3 ${["معرفی", "سوابق کاری", "سوابق هنری و فرهنگی", "شبکه‌های اجتماعی"].includes(String(label)) ? "sm:col-span-2" : ""}`}>
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-7 text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {showCreate && (
        <Modal
          title="ایجاد کاربر جدید"
          onClose={() => { if (!saving) setShowCreate(false); }}
          maxWidth="max-w-md"
          footer={
            <PrimaryButton onClick={createUser} disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />}ایجاد کاربر
            </PrimaryButton>
          }
        >
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-slate-900">نام و نام خانوادگی</label><input value={createForm.name} onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))} className={`w-full ${INPUT_CLASS}`} /></div>
            <div><label className="mb-1 block text-sm font-medium text-slate-900">ایمیل</label><input type="email" value={createForm.email} onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))} className={`w-full ${INPUT_CLASS}`} /></div>
            <div><label className="mb-1 block text-sm font-medium text-slate-900">رمز عبور</label><input type="password" minLength={6} value={createForm.password} onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))} className={`w-full ${INPUT_CLASS}`} /></div>
            <div><label className="mb-1 block text-sm font-medium text-slate-900">نوع کاربر</label><select value={createForm.userType} onChange={(event) => setCreateForm((form) => ({ ...form, userType: event.target.value }))} className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}><option value="student">دانشجو</option><option value="instructor">مدرس</option></select><p className="mt-1 text-xs text-slate-500">با انتخاب مدرس، پروفایل استاد نیز خودکار ایجاد و قابل اتصال به دوره می‌شود.</p></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
