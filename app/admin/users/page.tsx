"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  UserCog,
  User,
  Calendar,
  GraduationCap,
} from "lucide-react";
import { getCookie } from "@/lib/cookie";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  enrollmentCount: number;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = getCookie("token");
    if (!token) return;

    fetch("/api/users", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = users.filter(
    (u) =>
      u.name.includes(search) ||
      u.email.includes(search) ||
      u.role.includes(search)
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
            placeholder="جستجوی کاربر..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] focus:border-[#03004b]"
          />
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
                <th className="text-right p-3 font-medium text-outline hidden md:table-cell">تاریخ ثبت‌نام</th>
                <th className="text-center p-3 font-medium text-outline hidden lg:table-cell">تعداد ثبت‌نام‌ها</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#eeecfc] flex items-center justify-center text-[#03004b] font-bold text-sm shrink-0">
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
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-[#ffdeab] text-[#7b5814]"
                          : "bg-[#eeecfc] text-[#03004b]"
                      }`}
                    >
                      {user.role === "admin" ? <UserCog size={12} /> : <User size={12} />}
                      {user.role === "admin" ? "ادمین" : "کاربر"}
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
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-outline">
                    کاربری یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
