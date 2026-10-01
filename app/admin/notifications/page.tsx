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
import {
  Badge,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchInput,
  SecondaryButton,
  Td,
  Th,
} from "@/components/admin/ui";

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

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";

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
      <div className="flex items-center justify-center h-64 text-red-600 gap-2">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="اعلان‌ها"
        actions={
          tab === "notifications" ? (
            <PrimaryButton onClick={openCreateModal}>
              <Plus size={18} />
              اعلان جدید
            </PrimaryButton>
          ) : null
        }
      />
      <div className="flex gap-2 border-b border-slate-200"><button onClick={() => setTab("notifications")} className={`px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${tab === "notifications" ? "border-b-2 border-[#03004b] text-[#03004b]" : "text-slate-500"}`}>اعلان‌ها</button><button onClick={() => setTab("email")} className={`px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${tab === "email" ? "border-b-2 border-[#03004b] text-[#03004b]" : "text-slate-500"}`}>ارسال ایمیل</button></div>
      {tab === "email" ? <EmailComposer /> : <>
      <div className="relative w-full sm:w-64">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <SearchInput
          type="text"
          placeholder="جستجوی اعلان..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        head={
          <>
            <Th>عنوان</Th>
            <Th className="hidden sm:table-cell">پیام</Th>
            <Th center className="hidden md:table-cell">نوع</Th>
            <Th center className="hidden md:table-cell">کانال</Th>
            <Th center className="hidden lg:table-cell">همه کاربران</Th>
            <Th center>وضعیت</Th>
            <Th className="hidden lg:table-cell">تاریخ</Th>
          </>
        }
      >
        {filtered.map((notif) => (
          <tr key={notif.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
            <Td>
              <div className="font-bold text-slate-900">{notif.title}</div>
            </Td>
            <Td className="hidden max-w-[200px] truncate text-slate-500 sm:table-cell">
              {notif.message}
            </Td>
            <Td className="hidden text-center md:table-cell">
              <span className="text-xs text-slate-500">{typeLabels[notif.type] || notif.type}</span>
            </Td>
            <Td className="hidden text-center md:table-cell">
              <span className="text-xs text-slate-500">{channelLabels[notif.channel] || notif.channel}</span>
            </Td>
            <Td className="hidden text-center lg:table-cell">
              {notif.sendToAll ? (
                <Check size={14} className="mx-auto text-emerald-600" />
              ) : (
                <X size={14} className="mx-auto text-slate-400" />
              )}
            </Td>
            <Td className="text-center">
              <Badge tone={notif.sent ? "emerald" : "amber"}>
                {notif.sent ? <Check size={12} /> : <Clock size={12} />}
                {notif.sent ? "ارسال شده" : "در انتظار"}
              </Badge>
            </Td>
            <Td className="hidden lg:table-cell">
              <div className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                <Clock size={12} />
                {formatDateShort(notif.createdAt)}
              </div>
            </Td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr>
            <Td colSpan={7}>
              <EmptyState message="اعلانی یافت نشد" />
            </Td>
          </tr>
        )}
      </DataTable>

      {showModal && (
        <Modal
          title="ارسال اعلان جدید"
          onClose={() => !saving && setShowModal(false)}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">عنوان</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className={`w-full ${INPUT_CLASS}`}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">پیام</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                className={`w-full resize-none ${INPUT_CLASS}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">نوع</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`}
                >
                  <option value="in-app">داخل برنامه</option>
                  <option value="email">ایمیل</option>
                  <option value="sms">پیامک</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">کانال ارسال</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`}
                >
                  <option value="all">همه</option>
                  <option value="in-app">داخل برنامه</option>
                  <option value="email">ایمیل</option>
                  <option value="sms">پیامک</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">دوره (اختیاری)</label>
              <select
                value={form.courseId}
                onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                className={`w-full ${INPUT_CLASS}`}
              >
                <option value="">بدون دوره</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendToAll}
                  onChange={(e) => setForm((p) => ({ ...p, sendToAll: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 accent-[#03004b]"
                />
                <span className="text-sm text-slate-700">ارسال به همه کاربران</span>
              </label>
            </div>

            {!form.sendToAll && (
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">انتخاب کاربران</label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {users.length === 0 && (
                    <p className="p-2 text-xs text-slate-500">کاربری یافت نشد</p>
                  )}
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.userIds.includes(user.id)}
                        onChange={() => toggleUserId(user.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-[#03004b]"
                      />
                      <span className="text-sm text-slate-900">{user.name}</span>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <PrimaryButton
                type="submit"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                ارسال اعلان
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                انصراف
              </SecondaryButton>
            </div>
          </form>
        </Modal>
      )}
      </>}
    </div>
  );
}
