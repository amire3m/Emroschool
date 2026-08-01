"use client";

import { useState, useEffect } from "react";
import { Loader2, User, AlertCircle, Award, BookOpen } from "lucide-react";
import Link from "next/link";

interface InstructorUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  expertise?: string;
}

interface Instructor {
  id: string;
  name?: string;
  avatar?: string;
  bio?: string;
  expertise?: string;
  specialties?: string;
  profileSlug?: string | null;
  socialLinks?: string;
  showOnSite: boolean;
  eventCount: number;
  user?: InstructorUser;
}

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchInstructors() {
      try {
        const res = await fetch("/api/instructors");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const all = data.instructors || [];
        setInstructors(all.filter((i: Instructor) => i.showOnSite !== false));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchInstructors();
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-primary mb-2">اساتید مدرسه</h1>
          <p className="text-outline">پیشکسوتان و متخصصان تراز اول هنر انقلاب</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-secondary" />
          </div>
        ) : error ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <AlertCircle size={40} className="text-outline mx-auto mb-3" />
              <p className="text-outline text-lg">خطا در بارگذاری اساتید</p>
            </div>
          </div>
        ) : instructors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-outline-variant/30">
            <User size={48} className="text-outline-variant mx-auto mb-3" />
            <p className="text-outline text-lg">هیچ استادی ثبت نشده است</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {instructors.map((instructor) => {
              const card = (
              <div
                key={instructor.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30 hover:shadow-xl transition-all group"
              >
                <div className="aspect-square overflow-hidden bg-surface-variant">
                  {(instructor.avatar || instructor.user?.avatar) ? (
                    <img
                      src={instructor.avatar || instructor.user?.avatar || ""}
                      alt={instructor.name || instructor.user?.name || ""}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={64} className="text-outline-variant" />
                    </div>
                  )}
                </div>
                <div className="p-5 text-right">
                  <h3 className="font-bold text-primary text-lg mb-1">
                    {instructor.name || instructor.user?.name || ""}
                  </h3>
                  {instructor.expertise && (
                    <p className="text-secondary text-sm mb-2">
                      {instructor.expertise}
                    </p>
                  )}
                  {instructor.user?.bio && (
                    <p className="text-outline text-xs leading-relaxed line-clamp-3 mb-3">
                      {instructor.user.bio}
                    </p>
                  )}
                  {instructor.specialties && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {instructor.specialties.split(",").map((s, i) => (
                        <span
                          key={i}
                          className="text-xs bg-surface-variant text-outline px-2 py-0.5 rounded-full"
                        >
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {instructor.eventCount > 0 && (
                    <div className="flex items-center gap-1 text-outline text-xs border-t border-outline-variant/20 pt-3 mt-2">
                      <Award size={14} />
                      <span>{instructor.eventCount} رویداد</span>
                    </div>
                  )}
                </div>
              </div>
              );
               return <Link key={instructor.id} href={`/instructors/${instructor.profileSlug || instructor.id}`}>{card}</Link>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
