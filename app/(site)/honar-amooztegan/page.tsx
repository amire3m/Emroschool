"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Medal, Star, Quote, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface AlumniItem {
  id: string;
  name: string;
  field: string;
  batch: string;
  quote: string;
  imageUrl: string | null;
  achievements: string | null;
  showOnSite: boolean;
  user?: { id: string; name: string; avatar: string | null } | null;
}

export default function HonarAmoozteganPage() {
  const [alumni, setAlumni] = useState<AlumniItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/alumni")
      .then((r) => r.json())
      .then((data) => {
        const all = data.alumni || [];
        setAlumni(all.filter((i: AlumniItem) => i.showOnSite !== false));
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  return (
    <div>
      <section className="relative pt-32 pb-20 bg-gradient-to-b from-primary to-primary-container overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/20 text-secondary-fixed border border-secondary/30 rounded-full text-sm font-bold mb-6">
            <GraduationCap size={16} />
            هنر آموختگان آکادمی
          </div>
          <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl text-secondary-fixed mb-6">
            فارغ‌التحصیلان <span className="text-secondary">موفق</span>
          </h1>
          <p className="text-surface-variant text-lg max-w-2xl mx-auto leading-relaxed">
            هنرآموختگانی که پس از گذراندن دوره‌های تخصصی در آکادمی، اکنون در
            عرصه هنر و رسانه کشور می‌درخشند.
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-secondary" />
            </div>
          ) : error ? (
            <div className="flex justify-center py-20">
              <div className="text-center">
                <AlertCircle size={40} className="text-outline mx-auto mb-3" />
                <p className="text-outline text-lg">خطا در بارگذاری</p>
              </div>
            </div>
          ) : alumni.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap size={48} className="text-outline-variant mx-auto mb-3" />
              <p className="text-outline text-lg">هنوز هنرآموخته‌ای ثبت نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {alumni.map((person) => {
                const card = (
                <div className="group bg-white rounded-2xl border border-surface-variant overflow-hidden hover:shadow-lg transition-all">
                  <div className="relative h-48 bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center">
                    {person.imageUrl ? (
                      <img src={person.imageUrl} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-secondary-fixed">
                        <Medal size={40} className="text-secondary" />
                      </div>
                    )}
                    <span className="absolute top-3 right-3 bg-secondary text-white text-xs px-2 py-1 rounded-lg font-bold">{person.batch}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-primary mb-1">{person.name}</h3>
                    <p className="text-secondary font-medium text-sm mb-3">{person.field}</p>
                    {person.quote && (
                      <div className="flex items-start gap-2 mb-4">
                        <Quote size={14} className="text-outline shrink-0 mt-1" />
                        <p className="text-outline text-sm italic leading-relaxed">{person.quote}</p>
                      </div>
                    )}
                    {person.achievements && (
                      <div className="border-t border-surface-variant pt-3 mt-3">
                        <div className="flex flex-wrap gap-2">
                          {person.achievements.split(",").map((ach, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs bg-surface-low text-outline px-2.5 py-1 rounded-lg">
                              <Star size={10} className="text-secondary" />
                              {ach.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                );
                return person.user?.id ? <Link key={person.id} href={`/profile/${person.user.id}`}>{card}</Link> : <div key={person.id}>{card}</div>;
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 bg-gradient-to-l from-primary to-primary-container text-white">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 text-center">
          <h2 className="font-playfair text-3xl md:text-4xl text-secondary-fixed mb-4">
            شما هم می‌توانید یک هنرآموخته باشید
          </h2>
          <p className="text-surface-variant max-w-xl mx-auto mb-8">
            به جمع هنرآموختگان آکادمی بپیوندید و مسیر حرفه‌ای خود را در هنر و رسانه آغاز کنید.
          </p>
          <Link href="/courses" className="inline-block bg-secondary text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-secondary-container transition-all active:scale-95">
            مشاهده دوره‌ها
          </Link>
        </div>
      </section>
    </div>
  );
}
