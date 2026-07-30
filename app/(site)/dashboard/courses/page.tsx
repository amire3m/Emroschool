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
interface Application { id: string; status: string; createdAt: string; course: CourseInfo & { startDate?: string | null }; }

function formatPrice(price: number) {
  return price.toLocaleString("fa-IR");
}

export default function DashboardCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchEnrollments() {
      const token = getCookie("token");
      if (!token) return;

      try {
        const [res, applicationsRes] = await Promise.all([fetch("/api/user/enrollments", { headers: { Authorization: `Bearer ${token}` } }), fetch("/api/course-applications", { headers: { Authorization: `Bearer ${token}` } })]);
        if (!res.ok || !applicationsRes.ok) throw new Error("Failed");
        const [data, applicationData] = await Promise.all([res.json(), applicationsRes.json()]);
        setEnrollments(data.enrollments || []); setApplications(applicationData.applications || []);
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

      {applications.length > 0 && <section className="mb-9"><h2 className="font-black text-primary mb-3">درخواست‌های ثبت‌نام</h2><div className="grid md:grid-cols-2 gap-4">{applications.map((application) => <Link href={`/courses/${application.course.slug}`} key={application.id} className="bg-white rounded-2xl border border-outline-variant/30 p-4 flex gap-4 hover:shadow-lg transition-shadow"><div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-low shrink-0">{application.course.thumbnail && <img src={application.course.thumbnail} alt="" className="w-full h-full object-cover" />}</div><div className="min-w-0"><h3 className="font-bold text-primary truncate">{application.course.title}</h3><span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${application.status === "approved" ? "bg-green-50 text-green-700" : application.status === "rejected" ? "bg-error-container text-error" : "bg-yellow-50 text-yellow-700"}`}>{application.status === "approved" ? "تأیید شده" : application.status === "rejected" ? "رد شده" : "در انتظار بررسی"}</span><p className="text-[11px] text-outline mt-2">ارسال: {new Date(application.createdAt).toLocaleDateString("fa-IR")}</p></div></Link>)}</div></section>}

      {enrollments.length === 0 && applications.length === 0 ? (
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
