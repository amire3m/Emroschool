"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

type UserRequest = { id: string; name: string; email: string; userType: string; profileApprovalStatus: string; createdAt: string };

export default function SupportPage() {
  const [users, setUsers] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const auth = () => ({ authorization: `Bearer ${getCookie("token") || ""}` });
  const load = async () => { setLoading(true); try { const response = await fetch("/api/users", { headers: auth() }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setUsers((data.users || []).filter((user: UserRequest) => user.profileApprovalStatus === "pending")); } catch (error) { toast.error(error instanceof Error ? error.message : "دریافت صف پشتیبانی ناموفق بود"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const review = async (id: string, status: "approved" | "rejected") => { const rejectionReason = status === "rejected" ? window.prompt("دلیل رد پروفایل را برای کاربر بنویسید:")?.trim() : ""; if (status === "rejected" && !rejectionReason) return; setReviewing(id); try { const response = await fetch(`/api/admin/users/${id}/profile-review`, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify({ status, rejectionReason }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success(status === "approved" ? "پروفایل تایید شد" : "درخواست رد شد"); load(); } catch (error) { toast.error(error instanceof Error ? error.message : "ثبت بررسی ناموفق بود"); } finally { setReviewing(null); } };
  return <div className="mx-auto max-w-4xl space-y-5" dir="rtl"><section className="rounded-3xl bg-primary p-6 text-white"><div className="flex items-center gap-3"><Users className="text-secondary-fixed" /><div><h2 className="font-black">پشتیبانی کاربران</h2><p className="mt-1 text-sm text-white/65">این بخش صف آنلاین درخواست‌های بررسی پروفایل است و قابلیت گفتگوی ساختگی ندارد.</p></div></div></section>{loading ? <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : <section className="overflow-hidden rounded-3xl border border-surface-variant bg-white"><div className="border-b border-surface-variant p-5 font-black text-primary">درخواست‌های در انتظار ({users.length.toLocaleString("fa-IR")})</div><div className="divide-y divide-surface-variant">{users.map((user) => <div key={user.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-bold text-primary">{user.name}</p><p className="mt-1 text-xs text-outline">{user.email} · {user.userType}</p></div><div className="flex gap-2"><button onClick={() => review(user.id, "approved")} disabled={reviewing === user.id} className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={15} />تایید</button><button onClick={() => review(user.id, "rejected")} disabled={reviewing === user.id} className="rounded-xl bg-error px-3 py-2 text-xs font-bold text-white disabled:opacity-50">رد</button></div></div>)}{users.length === 0 && <p className="p-10 text-center text-sm text-outline">درخواستی در صف پشتیبانی نیست.</p>}</div></section>}</div>;
}
