"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  Search,
  X,
  Check,
  Send,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import EmailComposer from "@/components/admin/email-composer";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  sendToAll: boolean;
  sent: boolean;
  sentAt: string | null;
  createdAt: string;
  courseId: string | null;
  userIds: string[];
}

interface UserData {
  id: string;
  name: string;
  email: string;
}

interface Course {
  id: string;
  title: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    month: "short",
    day: "numeric",
  });
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"notifications" | "email">("notifications");

  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "in-app",
    channel: "all",
    sendToAll: true,
    courseId: "",
    userIds: [] as string[],
  });

  const getToken = () => getCookie("token") || "";

  const fetchData = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/notifications", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/users", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/courses", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([notifData, usersData, coursesData]) => {
        const items = notifData.notifications || notifData || [];
        setNotifications(Array.isArray(items) ? items : []);
        if (usersData.users) setUsers(usersData.users);
        if (coursesData.courses) setCourses(coursesData.courses);
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
      message: "",
      type: "in-app",
      channel: "all",
      sendToAll: true,
      courseId: "",
      userIds: [],
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const toggleUserId = (id: string) => {
    setForm((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(id)
        ? prev.userIds.filter((u) => u !== id)
        : [...prev.userIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sendToAll && form.userIds.length === 0) {
      toast.error("حداقل یک کاربر را انتخاب کنید");
      return;
    }
    setSaving(true);
    const token = getToken();

    const body = {
      title: form.title,
      message: form.message,
      type: form.type,
      channel: form.channel,
      sendToAll: form.sendToAll,
      courseId: form.courseId || null,
      userIds: form.sendToAll ? [] : form.userIds,
    };

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در ارسال اعلان");
      }
      toast.success("اعلان با موفقیت ارسال شد");
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const filtered = notifications.filter(
    (n) =>
      n.title.includes(search) ||
      n.message.includes(search)
  );

  const typeLabels: Record<string, string> = {
    "in-app": "داخل برنامه",
    email: "ایمیل",
    sms: "پیامک",
  };

  const channelLabels: Record<string, string> = {
    all: "همه",
    email: "ایمیل",
    sms: "پیامک",
    "in-app": "داخل برنامه",
  };

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
      <div className="mb-6 flex gap-2 border-b border-surface-variant"><button onClick={() => setTab("notifications")} className={`px-5 py-3 text-sm font-bold ${tab === "notifications" ? "border-b-2 border-primary text-primary" : "text-outline"}`}>اعلان‌ها</button><button onClick={() => setTab("email")} className={`px-5 py-3 text-sm font-bold ${tab === "email" ? "border-b-2 border-primary text-primary" : "text-outline"}`}>ارسال ایمیل</button></div>
      {tab === "email" ? <EmailComposer /> : <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder="جستجوی اعلان..."
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
          اعلان جدید
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-variant bg-surface-low">
                <th className="text-right p-3 font-medium text-outline">عنوان</th>
                <th className="text-right p-3 font-medium text-outline hidden sm:table-cell">پیام</th>
                <th className="text-center p-3 font-medium text-outline hidden md:table-cell">نوع</th>
                <th className="text-center p-3 font-medium text-outline hidden md:table-cell">کانال</th>
                <th className="text-center p-3 font-medium text-outline hidden lg:table-cell">همه کاربران</th>
                <th className="text-center p-3 font-medium text-outline">وضعیت</th>
                <th className="text-left p-3 font-medium text-outline hidden lg:table-cell">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((notif) => (
                <tr key={notif.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-low/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-primary">{notif.title}</div>
                  </td>
                  <td className="p-3 text-outline hidden sm:table-cell max-w-[200px] truncate">
                    {notif.message}
                  </td>
                  <td className="p-3 text-center hidden md:table-cell">
                    <span className="text-xs text-outline">{typeLabels[notif.type] || notif.type}</span>
                  </td>
                  <td className="p-3 text-center hidden md:table-cell">
                    <span className="text-xs text-outline">{channelLabels[notif.channel] || notif.channel}</span>
                  </td>
                  <td className="p-3 text-center hidden lg:table-cell">
                    {notif.sendToAll ? (
                      <Check size={14} className="mx-auto text-green-600" />
                    ) : (
                      <X size={14} className="mx-auto text-outline" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        notif.sent
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {notif.sent ? <Check size={12} /> : <Clock size={12} />}
                      {notif.sent ? "ارسال شده" : "در انتظار"}
                    </span>
                  </td>
                  <td className="p-3 text-outline hidden lg:table-cell">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock size={12} />
                      {formatDateShort(notif.createdAt)}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-outline">
                    اعلانی یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">ارسال اعلان جدید</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-outline hover:text-primary p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">عنوان</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">پیام</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">نوع</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  >
                    <option value="in-app">داخل برنامه</option>
                    <option value="email">ایمیل</option>
                    <option value="sms">پیامک</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">کانال ارسال</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                  >
                    <option value="all">همه</option>
                    <option value="in-app">داخل برنامه</option>
                    <option value="email">ایمیل</option>
                    <option value="sms">پیامک</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">دوره (اختیاری)</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
                >
                  <option value="">بدون دوره</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sendToAll}
                    onChange={(e) => setForm((p) => ({ ...p, sendToAll: e.target.checked }))}
                    className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                  />
                  <span className="text-sm text-primary">ارسال به همه کاربران</span>
                </label>
              </div>

              {!form.sendToAll && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">انتخاب کاربران</label>
                  <div className="max-h-40 overflow-y-auto border border-surface-variant rounded-xl p-2 space-y-1">
                    {users.length === 0 && (
                      <p className="text-xs text-outline p-2">کاربری یافت نشد</p>
                    )}
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-low cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.userIds.includes(user.id)}
                          onChange={() => toggleUserId(user.id)}
                          className="w-4 h-4 rounded border-surface-variant text-[#03004b] focus:ring-[#ffdeab]"
                        />
                        <span className="text-sm text-primary">{user.name}</span>
                        <span className="text-xs text-outline">{user.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#03004b] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1b1c5e] transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  ارسال اعلان
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
      </>}
    </div>
  );
}
