"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  BookOpen,
  Play,
  Award,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { getCookie } from "@/lib/cookie";

interface CourseInfo {
  id: string;
  title: string;
  slug: string;
  thumbnail?: string;
  instructor?: string;
  price: number;
}

interface Enrollment {
  id: string;
  progress: number;
  completed: boolean;
  createdAt: string;
  course: CourseInfo;
}

function formatPrice(price: number) {
  return price.toLocaleString("fa-IR");
}

export default function DashboardCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchEnrollments() {
      const token = getCookie("token");
      if (!token) return;

      try {
        const res = await fetch("/api/user/enrollments", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setEnrollments(data.enrollments || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchEnrollments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle size={40} className="text-outline mx-auto mb-3" />
          <p className="text-outline">خطا در بارگذاری دوره‌ها</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">دوره‌های من</h1>
        <p className="text-outline mt-1">دوره‌هایی که ثبت‌نام کرده‌اید</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-12 text-center">
          <BookOpen size={64} className="mx-auto text-outline-variant mb-4" />
          <p className="text-outline text-lg mb-2">
            هنوز در دوره‌ای ثبت‌نام نکرده‌اید
          </p>
          <p className="text-outline-variant text-sm mb-6">
            برای شروع یادگیری، دوره‌های ما را مرور کنید
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-container transition-all"
          >
            مشاهده دوره‌ها
            <ChevronLeft size={18} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="flex flex-col sm:flex-row">
                <div className="relative w-full sm:w-48 h-40 shrink-0">
                  {enrollment.course.thumbnail ? (
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${enrollment.course.thumbnail})`,
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-variant flex items-center justify-center">
                      <BookOpen size={32} className="text-outline-variant" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-primary mb-1 line-clamp-2">
                      {enrollment.course.title}
                    </h3>
                    {enrollment.course.instructor && (
                      <p className="text-outline text-xs mb-3">
                        {enrollment.course.instructor}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 bg-surface-variant rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-secondary h-full rounded-full transition-all"
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-secondary">
                        {enrollment.progress}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/20">
                    {enrollment.completed ? (
                      <span className="flex items-center gap-1 text-xs bg-secondary-fixed/30 text-secondary px-3 py-1.5 rounded-full font-bold">
                        <Award size={14} />
                        تکمیل شده
                      </span>
                    ) : (
                      <Link
                        href={`/courses/${enrollment.course.slug}`}
                        className="flex items-center gap-1 text-xs bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-container transition-all"
                      >
                        <Play size={14} />
                        ادامه یادگیری
                      </Link>
                    )}
                    <span className="text-outline text-xs">
                      {formatPrice(enrollment.course.price)} تومان
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
