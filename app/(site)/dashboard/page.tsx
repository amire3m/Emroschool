"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Award,
  Loader2,
  BookText,
  Bell,
  ChevronLeft,
  User,
  Settings,
} from "lucide-react";
import { getCookie } from "@/lib/cookie";

interface Enrollment {
  id: string;
  progress: number;
  completed: boolean;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail?: string;
    instructor?: string;
  };
}

interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  userNotificationId: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const token = getCookie("token");
      if (!token) return;

      try {
        const [profileRes, enrollRes, notifRes] = await Promise.all([
          fetch("/api/user/profile", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/user/enrollments", {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
          fetch("/api/notifications", {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setUser(data.user);
        }

        if (enrollRes && enrollRes.ok) {
          const data = await enrollRes.json();
          setEnrollments(data.enrollments || []);
        }

        if (notifRes && notifRes.ok) {
          const data = await notifRes.json();
          setNotifications((data.notifications || []).slice(0, 5));
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const completedCount = enrollments.filter((e) => e.completed).length;
  const inProgressCount = enrollments.filter((e) => !e.completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">
          {user ? `خوش آمدید، ${user.name}` : "داشبورد کاربری"}
        </h1>
        <p className="text-outline mt-1">به پنل کاربری خود خوش آمدید</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-outline-variant/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-fixed/30 flex items-center justify-center">
              <BookOpen size={24} className="text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-black text-primary">{inProgressCount}</p>
              <p className="text-outline text-sm">دوره‌های در حال یادگیری</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-outline-variant/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-fixed/30 flex items-center justify-center">
              <Award size={24} className="text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-black text-primary">{completedCount}</p>
              <p className="text-outline text-sm">دوره‌های تکمیل شده</p>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/courses"
          className="bg-white rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                <BookText size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">دوره‌های من</p>
                <p className="text-outline text-xs">مشاهده همه</p>
              </div>
            </div>
            <ChevronLeft
              size={20}
              className="text-outline group-hover:text-primary transition-colors"
            />
          </div>
        </Link>
        <Link
          href="/dashboard/profile"
          className="bg-white rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                <User size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">ویرایش پروفایل</p>
                <p className="text-outline text-xs">تنظیمات حساب</p>
              </div>
            </div>
            <ChevronLeft
              size={20}
              className="text-outline group-hover:text-primary transition-colors"
            />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-6">
          <h2 className="text-lg font-bold text-primary mb-4">دوره‌های من</h2>

          {enrollments.length === 0 ? (
            <div className="text-center py-8">
              <BookText size={40} className="mx-auto text-outline-variant mb-3" />
              <p className="text-outline mb-2">
                هنوز در دوره‌ای ثبت‌نام نکرده‌اید
              </p>
              <Link
                href="/courses"
                className="inline-block bg-primary text-white px-5 py-2 rounded-lg font-bold hover:bg-primary-container transition-all text-sm"
              >
                مشاهده دوره‌ها
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {enrollments.slice(0, 3).map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-low hover:bg-surface-container transition-colors"
                >
                  {enrollment.course.thumbnail ? (
                    <div
                      className="w-12 h-12 rounded-xl bg-cover bg-center shrink-0"
                      style={{
                        backgroundImage: `url(${enrollment.course.thumbnail})`,
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center shrink-0">
                      <BookOpen size={20} className="text-outline" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/courses/${enrollment.course.slug}`}
                      className="font-bold text-primary hover:text-secondary transition-colors text-sm"
                    >
                      {enrollment.course.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 bg-surface-variant rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-secondary h-full rounded-full"
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-secondary">
                        {enrollment.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {enrollments.length > 3 && (
                <Link
                  href="/dashboard/courses"
                  className="block text-center text-secondary font-bold text-sm hover:underline pt-2"
                >
                  مشاهده همه دوره‌ها
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">اعلان‌ها</h2>
            <Bell size={20} className="text-outline" />
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell size={40} className="mx-auto text-outline-variant mb-3" />
              <p className="text-outline text-sm">اعلانی وجود ندارد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl text-sm ${
                    notif.read
                      ? "bg-surface-low"
                      : "bg-secondary-fixed/20 border-r-2 border-secondary"
                  }`}
                >
                  <p className="font-bold text-primary">{notif.title}</p>
                  <p className="text-outline text-xs mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                </div>
              ))}
              <Link
                href="/dashboard"
                className="block text-center text-secondary font-bold text-sm hover:underline pt-2"
              >
                مشاهده همه
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
