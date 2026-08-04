"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, AlertCircle, UserCog, User, Calendar, GraduationCap, Pencil, X, Save, Plus, Check, LogIn, Trash2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie, setCookie } from "@/lib/cookie";

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
  avatar: string | null; phone: string | null; balePhone: string | null; nationalCode: string | null; emailVerified: boolean; phoneVerified: boolean; bio: string | null; expertise: string | null; socialLinks: string | null; birthDate: string | null; gender: string | null; province: string | null; city: string | null; district: string | null; neighborhood: string | null; address: string | null; postalCode: string | null; educationLevel: string | null; educationField: string | null; university: string | null; universityField: string | null; workHistory: string | null; artHistory: string | null; instagramId: string | null; virtualPhone: string | null; landline: string | null; newsletterSubscribed: boolean; notificationEmailEnabled: boolean; notificationSmsEnabled: boolean; notificationBaleEnabled: boolean; profileRejectionReason?: string | null; avatarSubmissions?: Array<{ id: string; imageUrl: string; status: string; rejectionReason?: string | null; submittedAt: string }>;
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
  const [editTab, setEditTab] = useState<"identity" | "contact" | "profile" | "access">("identity");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", userType: "student" });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [profileReviewUser, setProfileReviewUser] = useState<UserData | null>(null);

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
  };
  const textField = (field: string, label: string, type = "text") => <div><label className="mb-1 block text-sm font-medium text-primary">{label}</label><input type={type} value={String(editForm[field] || "")} onChange={(event) => setEditForm((form) => ({ ...form, [field]: event.target.value }))} className="w-full rounded-xl border border-surface-variant px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" /></div>;
  const toggleField = (field: string, label: string, hint: string) => <label className="flex cursor-pointer items-center justify-between rounded-xl border border-surface-variant bg-surface-low p-3"><span><span className="block text-sm font-medium text-primary">{label}</span><span className="mt-0.5 block text-xs text-outline">{hint}</span></span><input type="checkbox" checked={Boolean(editForm[field])} onChange={(event) => setEditForm((form) => ({ ...form, [field]: event.target.checked }))} className="h-4 w-4 accent-primary" /></label>;

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
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-error gap-2"><AlertCircle size={20} /><span>خطا: {error}</span></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" />
            <input type="text" placeholder="جستجوی کاربر..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed">
            <option value="all">همه</option>
            <option value="student">دانشجو</option>
            <option value="instructor">مدرس</option>
            <option value="alumni">فارغ‌التحصیل</option>
            <option value="admin">مدیر</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setProfileFilter("all")} className={`rounded-xl px-3 py-2 text-xs font-bold ${profileFilter === "all" ? "bg-primary text-white" : "border border-surface-variant bg-white text-outline"}`}>همه کاربران</button>
          <button onClick={() => setProfileFilter("pending")} className={`rounded-xl px-3 py-2 text-xs font-bold ${profileFilter === "pending" ? "bg-primary text-white" : "border border-surface-variant bg-white text-outline"}`}>درخواست‌های پروفایل ({users.filter((user) => user.profileApprovalStatus === "pending").length.toLocaleString("fa-IR")})</button>
        </div>
        <div className="flex items-center gap-3 text-sm text-outline">
          <span className="font-medium text-primary">{users.length.toLocaleString("fa-IR")}</span> کاربر
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"><Plus size={15} />ایجاد کاربر</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">نام</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">ایمیل</th>
                <th className="text-center p-3 font-medium text-outline">نقش</th>
                <th className="text-center p-3 font-medium text-outline hidden md:table-cell">نوع کاربر</th>
                <th className="text-center p-3 font-medium text-outline hidden lg:table-cell">پروفایل</th>
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">تاریخ ثبت‌نام</th>
                <th className="text-center p-3 font-medium text-outline hidden lg:table-cell">دوره‌ها</th>
                <th className="text-left p-3 font-medium text-outline">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-primary">{user.name}</div>
                        <div className="text-xs text-outline sm:hidden">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-outline hidden sm:table-cell">{user.email}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      user.role === "admin" || user.role === "superadmin"
                        ? "bg-secondary-fixed text-secondary"
                        : "bg-surface-container text-primary"
                    }`}>
                      {user.role === "admin" || user.role === "superadmin" ? <UserCog size={12} /> : <User size={12} />}
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden md:table-cell">
                    <span className="text-xs text-outline bg-surface-low px-2 py-1 rounded-lg">
                      {userTypeLabels[user.userType] || user.userType}
                    </span>
                  </td>
                  <td className="p-3 text-center hidden lg:table-cell"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.profileApprovalStatus === "approved" ? "bg-green-50 text-green-700" : user.profileApprovalStatus === "rejected" ? "bg-error-container text-error" : "bg-yellow-50 text-yellow-700"}`}>{user.profileApprovalStatus === "approved" ? "تایید شده" : user.profileApprovalStatus === "rejected" ? "رد شده" : "در انتظار"}</span></td>
                  <td className="p-3 text-outline hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDate(user.createdAt)}
                    </div>
                  </td>
                  <td className="p-3 text-center hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-1.5">
                      <GraduationCap size={14} className="text-outline" />
                      <span className="font-medium">{user.enrollmentCount.toLocaleString("fa-IR")}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setProfileReviewUser(user)} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs font-bold text-white" title="مشاهده و بررسی پروفایل"><Eye size={14} /><span className="hidden xl:inline">{user.profileApprovalStatus === "pending" || user.avatarSubmissions?.[0]?.status === "pending" ? "بررسی" : "وضعیت"}</span></button>
                      {user.role === "user" && <button onClick={() => impersonate(user)} disabled={impersonatingId === user.id} className="inline-flex items-center gap-1 rounded-lg border border-secondary px-2 py-1 text-xs font-bold text-secondary disabled:opacity-50" title="ورود به حساب کاربر">{impersonatingId === user.id ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}<span className="hidden xl:inline">ورود به حساب</span></button>}
                      <button onClick={() => openEdit(user)}
                        className="p-2 rounded-xl text-outline hover:text-primary hover:bg-surface-container transition-colors" title="ویرایش">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => deleteUser(user)} disabled={saving} className="p-2 rounded-xl text-outline hover:bg-error-container hover:text-error disabled:opacity-50" title="حذف کاربر"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-outline">کاربری یافت نشد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <div className="modal-overlay" onClick={() => !saving && setEditUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">ویرایش کاربر: {editUser.name}</h3>
              <button onClick={() => setEditUser(null)} className="text-outline hover:text-primary p-1"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 border-b border-surface-variant pb-3">{[["identity", "هویت و تحصیل"], ["contact", "تماس و نشانی"], ["profile", "پروفایل و اعلان"], ["access", "دسترسی و امنیت"]].map(([tab, label]) => <button key={tab} type="button" onClick={() => setEditTab(tab as typeof editTab)} className={`rounded-lg px-3 py-2 text-xs font-bold ${editTab === tab ? "bg-primary text-white" : "bg-surface-low text-outline"}`}>{label}</button>)}</div>
              {editTab === "identity" && <div className="grid gap-3 sm:grid-cols-2">{textField("name", "نام و نام خانوادگی")}{textField("email", "ایمیل", "email")}<p className="sm:col-span-2 text-xs text-outline">ایمیل ثبت‌شده توسط مدیر، تاییدشده محسوب می‌شود.</p>{textField("nationalCode", "کد ملی")}{textField("birthDate", "تاریخ تولد")}{textField("gender", "جنسیت")}{textField("educationLevel", "مقطع تحصیلی")}{textField("educationField", "رشته تحصیلی")}{textField("university", "دانشگاه")}{textField("universityField", "رشته دانشگاهی")}{textField("workHistory", "سابقه کاری")}{textField("artHistory", "سابقه هنری")}</div>}
              {editTab === "contact" && <div className="grid gap-3 sm:grid-cols-2">{textField("phone", "شماره موبایل")}{textField("balePhone", "شماره بله")}{textField("landline", "تلفن ثابت")}{textField("virtualPhone", "تلفن مجازی")}{textField("province", "استان")}{textField("city", "شهر")}{textField("district", "منطقه")}{textField("neighborhood", "محله")}{textField("postalCode", "کدپستی")}{textField("address", "نشانی")}</div>}
              {editTab === "profile" && <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{textField("expertise", "تخصص")}{textField("instagramId", "شناسه اینستاگرام")}</div>{textField("bio", "معرفی")}{textField("socialLinks", "لینک‌های اجتماعی")}<div className="grid gap-3 sm:grid-cols-2">{toggleField("newsletterSubscribed", "خبرنامه", "دریافت خبرنامه")}{toggleField("notificationEmailEnabled", "اعلان ایمیلی", "ارسال اعلان به ایمیل")}{toggleField("notificationSmsEnabled", "اعلان پیامکی", "ارسال اعلان پیامکی")}{toggleField("notificationBaleEnabled", "اعلان بله", "ارسال اعلان در بله")}</div></div>}
              {editTab === "access" && <>
              <div><label className="block text-sm font-medium text-primary mb-1">جایگاه اصلی</label><select value={String(editForm.userType)} onChange={(e) => setEditForm(p => ({ ...p, userType: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed"><option value="student">دانشجو</option><option value="instructor">مدرس</option><option value="alumni">فارغ‌التحصیل</option></select><p className="mt-1 text-xs text-outline">جایگاه آموزشی و نمایشی حساب، مستقل از دسترسی به پنل مدیریت است.</p></div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-surface-variant bg-surface-low p-4"><span><span className="block text-sm font-bold text-primary">دسترسی مدیریتی دارد</span><span className="mt-1 block text-xs text-outline">با فعال‌کردن، سطح دسترسی و مجوزهای پنل مدیریت قابل تنظیم است.</span></span><input type="checkbox" checked={editForm.role !== "user"} onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.checked ? "admin" : "user", permissions: event.target.checked ? form.permissions : "" }))} className="h-5 w-5 accent-primary" /></label>
              {editForm.role !== "user" && <>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">سطح دسترسی مدیریتی</label>
                <select value={String(editForm.role)} onChange={(e) => setEditForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed">
                  <option value="user">کاربر</option>
                  <option value="admin">ادمین</option>
                  <option value="superadmin">مدیر ارشد</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">دسترسی‌ها (JSON Array)</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-surface-variant p-3 sm:grid-cols-3">{[["courses", "دوره‌ها"], ["applications", "ثبت‌نام‌ها"], ["events", "رویدادها"], ["news", "اخبار"], ["instructors", "مدرس‌ها"], ["gallery", "گالری"], ["files", "فایل‌ها"], ["notifications", "اعلان‌ها"], ["users", "کاربران"], ["settings", "تنظیمات"], ["payments", "پرداخت‌ها"], ["discounts", "تخفیف"], ["support", "پشتیبانی"], ["impersonate", "ورود به حساب"]].map(([value, label]) => { let selected: string[] = []; try { selected = JSON.parse(String(editForm.permissions || "[]")); } catch {} return <label key={value} className="flex items-center gap-2 text-xs text-primary"><input type="checkbox" checked={selected.includes(value)} onChange={(event) => setEditForm((form) => ({ ...form, permissions: JSON.stringify(event.target.checked ? [...selected, value] : selected.filter((item) => item !== value)) }))} />{label}</label>; })}</div>
              </div></>}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-variant">
                <div>
                  <label className="text-sm font-medium text-primary">پروفایل عمومی</label>
                  <p className="text-xs text-outline mt-0.5">در صورت فعال بودن، دیگران می‌توانند پروفایل کاربر را ببینند</p>
                </div>
                <button type="button" onClick={() => setEditForm(p => ({ ...p, profileVisible: !p.profileVisible }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${editForm.profileVisible ? "bg-green-500" : "bg-surface-variant"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editForm.profileVisible ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div><label className="block text-sm font-medium text-primary mb-1">رمز عبور جدید</label><input type="password" value={String(editForm.password)} onChange={(e) => setEditForm((current) => ({ ...current, password: e.target.value }))} minLength={6} placeholder="برای حفظ رمز فعلی خالی بگذارید" className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" /><p className="text-xs text-outline mt-1">حداقل ۶ کاراکتر؛ مدیر می‌تواند برای کاربر رمز جدید تعیین کند.</p></div></>}
              <div className="flex items-center gap-3 pt-2">
                <button onClick={saveEdit} disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  <Save size={16} /> بروزرسانی
                </button>
                <button onClick={() => setEditUser(null)} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm text-outline border border-surface-variant hover:bg-surface-variant transition-colors">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {profileReviewUser && <div className="modal-overlay" onClick={() => !reviewingId && setProfileReviewUser(null)}><div className="modal-content max-w-3xl" onClick={(event) => event.stopPropagation()}><div className="mb-6 flex items-start justify-between gap-4"><div className="flex items-center gap-3">{profileReviewUser.avatar ? <img src={profileReviewUser.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-xl font-black text-primary">{profileReviewUser.name.charAt(0)}</span>}<div><p className="text-xs font-bold text-secondary">بررسی پروفایل عمومی</p><h2 className="mt-1 text-xl font-black text-primary">{profileReviewUser.name}</h2><p className="mt-1 text-xs text-outline">{profileReviewUser.email} {profileReviewUser.phone ? `· ${profileReviewUser.phone}` : ""}</p></div></div><button onClick={() => setProfileReviewUser(null)} disabled={Boolean(reviewingId)} className="p-2 text-outline"><X size={20} /></button></div>{profileReviewUser.avatarSubmissions?.[0]?.status === "pending" && <section className="mb-5 rounded-2xl border border-secondary/30 bg-[#fffaf0] p-4"><p className="text-sm font-black text-primary">بررسی تصویر پروفایل</p><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center"><img src={profileReviewUser.avatarSubmissions[0].imageUrl} alt="تصویر پیشنهادی پروفایل" className="h-28 w-28 rounded-2xl object-cover" /><div className="flex-1"><p className="text-xs leading-6 text-outline">تایید تصویر، آن را در پروفایل عمومی نمایش می‌دهد. رد تصویر، پروفایل را رد نمی‌کند.</p><div className="mt-3 flex gap-2"><button onClick={() => reviewAvatar(profileReviewUser, "approved")} disabled={reviewingId === profileReviewUser.id} className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white">تایید تصویر</button><button onClick={() => reviewAvatar(profileReviewUser, "rejected")} disabled={reviewingId === profileReviewUser.id} className="rounded-xl bg-error px-4 py-2 text-xs font-bold text-white">رد تصویر</button></div></div></div></section>}<div className="grid gap-3 sm:grid-cols-2">{[["معرفی", profileReviewUser.bio], ["تخصص", profileReviewUser.expertise], ["استان و شهر", [profileReviewUser.province, profileReviewUser.city, profileReviewUser.district, profileReviewUser.neighborhood].filter(Boolean).join("، ")], ["تاریخ تولد و جنسیت", [profileReviewUser.birthDate ? new Date(profileReviewUser.birthDate).toLocaleDateString("fa-IR") : "", profileReviewUser.gender === "male" ? "مرد" : profileReviewUser.gender === "female" ? "زن" : ""].filter(Boolean).join("، ")], ["تحصیلات", [profileReviewUser.educationLevel, profileReviewUser.educationField, profileReviewUser.university, profileReviewUser.universityField].filter(Boolean).join("، ")], ["اینستاگرام", profileReviewUser.instagramId], ["سوابق کاری", profileReviewUser.workHistory], ["سوابق هنری و فرهنگی", profileReviewUser.artHistory], ["شبکه‌های اجتماعی", profileReviewUser.socialLinks]].filter(([, value]) => value).map(([label, value]) => <div key={String(label)} className={`rounded-xl border border-surface-variant bg-surface-low p-3 ${["معرفی", "سوابق کاری", "سوابق هنری و فرهنگی", "شبکه‌های اجتماعی"].includes(String(label)) ? "sm:col-span-2" : ""}`}><p className="text-[11px] text-outline">{label}</p><p className="mt-1 whitespace-pre-line text-sm leading-7 text-primary">{value}</p></div>)}</div><div className="mt-6 flex flex-wrap gap-3 border-t border-surface-variant pt-5">{profileReviewUser.profileApprovalStatus === "pending" ? <><button onClick={async () => { await reviewProfile(profileReviewUser, "approved"); setProfileReviewUser(null); }} disabled={reviewingId === profileReviewUser.id} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Check size={16} />تایید پروفایل</button><button onClick={async () => { await reviewProfile(profileReviewUser, "rejected"); setProfileReviewUser(null); }} disabled={reviewingId === profileReviewUser.id} className="rounded-xl bg-error px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">رد پروفایل</button></> : <button onClick={async () => { await reviewProfile(profileReviewUser, "pending"); setProfileReviewUser(null); }} disabled={reviewingId === profileReviewUser.id} className="rounded-xl border border-secondary px-5 py-2.5 text-sm font-bold text-secondary disabled:opacity-50">بازگرداندن به انتظار بررسی</button>}</div></div></div>}
      {showCreate && <div className="modal-overlay" onClick={() => !saving && setShowCreate(false)}><div className="modal-content max-w-md" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold text-primary">ایجاد کاربر جدید</h3><button onClick={() => setShowCreate(false)} className="text-outline"><X size={20} /></button></div><div className="space-y-4"><div><label className="mb-1 block text-sm font-medium text-primary">نام و نام خانوادگی</label><input value={createForm.name} onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))} className="w-full rounded-xl border border-surface-variant px-3 py-2.5 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-primary">ایمیل</label><input type="email" value={createForm.email} onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))} className="w-full rounded-xl border border-surface-variant px-3 py-2.5 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-primary">رمز عبور</label><input type="password" minLength={6} value={createForm.password} onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))} className="w-full rounded-xl border border-surface-variant px-3 py-2.5 text-sm" /></div><div><label className="mb-1 block text-sm font-medium text-primary">نوع کاربر</label><select value={createForm.userType} onChange={(event) => setCreateForm((form) => ({ ...form, userType: event.target.value }))} className="w-full rounded-xl border border-surface-variant px-3 py-2.5 text-sm"><option value="student">دانشجو</option><option value="instructor">مدرس</option></select><p className="mt-1 text-xs text-outline">با انتخاب مدرس، پروفایل استاد نیز خودکار ایجاد و قابل اتصال به دوره می‌شود.</p></div><button onClick={createUser} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}ایجاد کاربر</button></div></div></div>}
    </div>
  );
}
