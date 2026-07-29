"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users, GraduationCap, Image, Loader2, AlertCircle } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import Link from "next/link";
import { APP_VERSION, releaseNotes } from "@/lib/version";

interface Stat {
  label: string;
  count: number;
  icon: typeof BookOpen;
  color: string;
  bg: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "تعداد دوره‌ها", count: 0, icon: BookOpen, color: "text-[#03004b]", bg: "bg-[#eeecfc]" },
    { label: "تعداد کاربران", count: 0, icon: Users, color: "text-[#7b5814]", bg: "bg-[#fdcd7e]" },
    { label: "تعداد ثبت‌نام‌ها", count: 0, icon: GraduationCap, color: "text-[#03004b]", bg: "bg-[#e2e1f0]" },
    { label: "تعداد تصاویر گالری", count: 0, icon: Image, color: "text-[#7b5814]", bg: "bg-[#ffdeab]" },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getCookie("token");
    if (!token) return;

    Promise.all([
      fetch("/api/courses", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/users", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/enroll", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/gallery", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([courses, users, enroll, gallery]) => {
        setStats([
          { label: "تعداد دوره‌ها", count: courses.courses?.length ?? 0, icon: BookOpen, color: "text-[#03004b]", bg: "bg-[#eeecfc]" },
          { label: "تعداد کاربران", count: users.users?.length ?? 0, icon: Users, color: "text-[#7b5814]", bg: "bg-[#fdcd7e]" },
          { label: "تعداد ثبت‌نام‌ها", count: 0, icon: GraduationCap, color: "text-[#03004b]", bg: "bg-[#e2e1f0]" },
          { label: "تعداد تصاویر گالری", count: gallery.images?.length ?? 0, icon: Image, color: "text-[#7b5814]", bg: "bg-[#ffdeab]" },
        ]);

        if (courses.courses) {
          const totalEnrollments = courses.courses.reduce((sum: number, c: { enrollmentCount?: number; _count?: { enrollments?: number } }) => {
            return sum + (c.enrollmentCount ?? c._count?.enrollments ?? 0);
          }, 0);
          setStats((prev) =>
            prev.map((s) =>
              s.label === "تعداد ثبت‌نام‌ها" ? { ...s, count: totalEnrollments || enroll.enrollments?.length || 0 } : s
            )
          );
        }

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
        <span>خطا در دریافت اطلاعات: {error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl border border-surface-variant shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <Icon size={28} className={stat.color} />
              </div>
              <div>
                <div className={`text-4xl font-black ${stat.color}`}>
                  {stat.count.toLocaleString("fa-IR")}
                </div>
                <div className="text-sm text-outline mt-0.5">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-surface-variant shadow-sm p-6">
        <h2 className="text-lg font-bold text-primary mb-2">خوش آمدید</h2>
        <p className="text-outline leading-7">
          به پنل مدیریت مدرسه هنر و رسانه امام روح‌الله خوش آمدید. از منوی سمت راست می‌توانید
          بخش‌های مختلف سایت را مدیریت کنید.
        </p>
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-surface-variant shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-5"><div><h2 className="text-lg font-bold text-primary">آخرین بروزرسانی‌ها</h2><p className="text-xs text-outline mt-1">سامانه در حال حاضر روی نسخه {APP_VERSION} است</p></div><Link href="/admin/updates" className="text-sm font-bold text-secondary hover:text-primary transition-colors">مشاهده همه</Link></div>
        <div className="space-y-3">{releaseNotes.slice(0, 3).map((note) => <div key={note.id} className="flex items-start justify-between gap-4 rounded-xl bg-surface-low p-4"><div><p className="font-bold text-primary text-sm">{note.title}</p><p className="text-xs text-outline mt-1 line-clamp-1">{note.summary}</p></div><time className="text-[11px] text-outline whitespace-nowrap">{new Date(note.publishedAt).toLocaleDateString("fa-IR")}</time></div>)}</div>
      </div>
    </div>
  );
}
