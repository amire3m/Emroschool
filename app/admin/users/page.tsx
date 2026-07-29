"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, AlertCircle, UserCog, User, Calendar, GraduationCap, Pencil, X, Save, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  permissions: string | null;
  profileVisible: boolean;
  createdAt: string;
  enrollmentCount: number;
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
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({ role: "", userType: "", permissions: "", profileVisible: true });
  const [saving, setSaving] = useState(false);

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

  const openEdit = (user: UserData) => {
    setEditUser(user);
    setEditForm({
      role: user.role,
      userType: user.userType,
      permissions: user.permissions || "",
      profileVisible: user.profileVisible,
    });
  };

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

  const filtered = users.filter((u) => {
    const matchSearch = u.name.includes(search) || u.email.includes(search) || u.role.includes(search);
    const matchType = filterType === "all" || u.userType === filterType;
    return matchSearch && matchType;
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
        <div className="text-sm text-outline">
          <span className="font-medium text-primary">{users.length.toLocaleString("fa-IR")}</span> کاربر
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
                      <button onClick={() => openEdit(user)}
                        className="p-2 rounded-xl text-outline hover:text-primary hover:bg-surface-container transition-colors" title="ویرایش">
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-outline">کاربری یافت نشد</td></tr>
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
              <div>
                <label className="block text-sm font-medium text-primary mb-1">ایمیل</label>
                <input type="text" value={editUser.email} disabled
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm bg-surface-low text-outline" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">نقش سیستمی</label>
                <select value={editForm.role} onChange={(e) => setEditForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed">
                  <option value="user">کاربر</option>
                  <option value="admin">ادمین</option>
                  <option value="superadmin">مدیر ارشد</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">نوع کاربر</label>
                <select value={editForm.userType} onChange={(e) => setEditForm(p => ({ ...p, userType: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed">
                  <option value="student">دانشجو</option>
                  <option value="instructor">مدرس</option>
                  <option value="alumni">فارغ‌التحصیل</option>
                  <option value="admin">مدیر</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">دسترسی‌ها (JSON Array)</label>
                <input type="text" value={editForm.permissions} onChange={(e) => setEditForm(p => ({ ...p, permissions: e.target.value }))}
                  placeholder='["courses", "events"]'
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed font-mono" />
                <p className="text-xs text-outline mt-1">مقادیر مجاز: courses, events, news, instructors, gallery, files, slider, notifications, users, settings</p>
              </div>
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
    </div>
  );
}
