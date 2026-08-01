"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowRight, Calendar, Award, GraduationCap } from "lucide-react";

interface PublicProfile {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  expertise: string | null;
  socialLinks: string | null;
  role: string;
  userType: string;
  createdAt: string;
  instructor: { specialties: string | null; showOnSite: boolean } | null;
  alumni: { field: string; batch: string; quote: string; achievements: string | null; showOnSite: boolean } | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/user/profile/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProfile(data.user || data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-outline mb-3" />
          <p className="text-outline text-lg">{error || "پروفایل یافت نشد"}</p>
          <Link href="/" className="mt-4 inline-flex items-center gap-2 text-secondary font-bold">
            <ArrowRight size={16} /> بازگشت به صفحه اصلی
          </Link>
        </div>
      </div>
    );
  }

  const userTypeLabels: Record<string, string> = {
    student: "هنرجو",
    instructor: "مدرس",
    alumni: "فارغ‌التحصیل",
    admin: "مدیر",
  };

  return (
    <div className="min-h-screen pt-32 pb-16 bg-surface-low" dir="rtl">
      <div className="max-w-3xl mx-auto px-5">
        <div className="bg-white rounded-3xl shadow-sm border border-surface-variant overflow-hidden">
          <div className="bg-gradient-to-l from-primary to-primary/80 p-8 text-center">
            <div className="w-28 h-28 rounded-full mx-auto border-4 border-secondary-fixed overflow-hidden mb-4">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary-light flex items-center justify-center text-3xl font-bold text-white">
                  {profile.name.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-secondary-fixed">{profile.name}</h1>
            <span className="inline-block mt-2 px-4 py-1 bg-secondary-fixed/20 text-secondary-fixed rounded-full text-sm font-medium border border-secondary-fixed/30">
              {userTypeLabels[profile.userType] || profile.userType}
            </span>
          </div>

          <div className="p-6 space-y-5">
            {profile.bio && (
              <div>
                <h3 className="text-sm font-medium text-outline mb-1">درباره</h3>
                <p className="text-primary leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {profile.expertise && (
              <div>
                <h3 className="text-sm font-medium text-outline mb-1">تخصص‌ها</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise.split(",").map((item, i) => (
                    <span key={i} className="px-3 py-1 bg-surface-low text-primary rounded-lg text-sm border border-surface-variant">
                      {item.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.userType === "instructor" && profile.instructor?.specialties && (
              <div>
                <h3 className="text-sm font-medium text-outline mb-2 flex items-center gap-1"><Award size={16} /> زمینه‌های تدریس</h3>
                <p className="text-primary leading-relaxed">{profile.instructor.specialties}</p>
              </div>
            )}

            {profile.userType === "alumni" && profile.alumni && (
              <div className="rounded-2xl bg-surface-low border border-surface-variant p-4 space-y-2">
                <h3 className="font-bold text-primary flex items-center gap-2"><GraduationCap size={18} /> اطلاعات هنرآموختگی</h3>
                {profile.alumni.field && <p className="text-sm text-outline">رشته: {profile.alumni.field}</p>}
                {profile.alumni.batch && <p className="text-sm text-outline">دوره: {profile.alumni.batch}</p>}
                {profile.alumni.quote && <p className="text-sm text-primary leading-relaxed">{profile.alumni.quote}</p>}
                {profile.alumni.achievements && <p className="text-sm text-outline">افتخارات: {profile.alumni.achievements}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-outline text-sm">
                <Calendar size={16} /> عضویت از {formatDate(profile.createdAt)}
              </div>
            </div>

            {profile.socialLinks && (
              <div>
                <h3 className="text-sm font-medium text-outline mb-2">شبکه‌های اجتماعی</h3>
                <p className="text-primary text-sm break-all">{profile.socialLinks}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-secondary font-bold hover:gap-3 transition-all">
            <ArrowRight size={16} /> بازگشت به صفحه اصلی
          </Link>
        </div>
      </div>
    </div>
  );
}
