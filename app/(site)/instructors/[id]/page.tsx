"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen, Loader2, User } from "lucide-react";

interface InstructorDetail {
  id: string;
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  expertise?: string | null;
  specialties?: string | null;
  socialLinks?: string | null;
  user?: { name: string; avatar?: string | null; bio?: string | null; expertise?: string | null; socialLinks?: string | null } | null;
  courses: Array<{ id: string; title: string; slug: string; thumbnail?: string | null; description: string; price: number; scheduleStatus: string }>;
}

export default function InstructorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/instructors/${id}`).then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data) => setInstructor(data.instructor)).catch(() => setInstructor(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-secondary" size={32} /></div>;
  if (!instructor) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><p className="text-outline">پروفایل استاد یافت نشد.</p><Link href="/instructors" className="font-bold text-secondary">بازگشت به اساتید</Link></div>;

  const name = instructor.name || instructor.user?.name || "استاد آکادمی";
  const avatar = instructor.avatar || instructor.user?.avatar;
  const bio = instructor.bio || instructor.user?.bio;
  const expertise = instructor.expertise || instructor.user?.expertise;
  return <div className="min-h-screen bg-surface-low pb-16 pt-24"><main className="mx-auto max-w-5xl px-5"><Link href="/instructors" className="mb-6 inline-flex items-center gap-1 text-sm text-outline hover:text-primary"><ArrowRight size={16} />بازگشت به اساتید</Link><section className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-white shadow-sm"><div className="bg-primary p-7 md:p-10"><div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-right"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-secondary-fixed bg-surface-variant">{avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary"><User size={46} /></div>}</div><div><p className="text-sm font-bold text-secondary-fixed">استاد آکادمی</p><h1 className="mt-1 text-3xl font-black text-white">{name}</h1>{expertise && <p className="mt-2 text-secondary-fixed/90">{expertise}</p>}</div></div></div><div className="p-6 md:p-8">{bio && <div><h2 className="font-bold text-primary">درباره استاد</h2><p className="mt-3 whitespace-pre-line leading-8 text-outline">{bio}</p></div>}{instructor.specialties && <div className="mt-6"><h2 className="font-bold text-primary">زمینه‌های تدریس</h2><div className="mt-3 flex flex-wrap gap-2">{instructor.specialties.split(",").map((item) => <span key={item} className="rounded-full bg-secondary-fixed/30 px-3 py-1 text-sm text-secondary">{item.trim()}</span>)}</div></div>}</div></section><section className="mt-10"><div className="mb-5 flex items-center gap-2"><BookOpen className="text-secondary" size={22} /><h2 className="text-xl font-black text-primary">دوره‌های این استاد</h2></div>{instructor.courses.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{instructor.courses.map((course) => <Link key={course.id} href={`/courses/${course.slug}`} className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-white transition hover:-translate-y-1 hover:shadow-lg">{course.thumbnail ? <img src={course.thumbnail} alt={course.title} className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center bg-surface-variant text-outline">تصویر دوره</div>}<div className="p-4"><h3 className="font-bold text-primary">{course.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-outline">{course.description}</p></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-outline-variant bg-white p-8 text-center text-outline">در حال حاضر دوره منتشرشده‌ای برای این استاد ثبت نشده است.</div>}</section></main></div>;
}
