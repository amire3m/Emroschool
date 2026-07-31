import Link from "next/link";
import { ArrowUpLeft, CalendarDays, Check, Layers3, PlayCircle, Sparkles } from "lucide-react";

interface CourseStep {
  id: string;
  title: string;
  slug: string;
  thumbnail?: string | null;
  description?: string;
  instructor?: string | null;
  price: number;
  registrationMode: "purchase" | "registration";
  scheduleStatus: string;
  startDate?: string | null;
}

interface ComprehensiveCoursePathProps {
  title: string;
  children: CourseStep[];
}

function formatPrice(price: number) {
  return price.toLocaleString("fa-IR");
}

export default function ComprehensiveCoursePath({ title, children }: ComprehensiveCoursePathProps) {
  if (!children.length) return null;

  return (
    <section className="comprehensive-course-path my-10 overflow-hidden rounded-[2rem] border border-primary/10 bg-[#07043c] text-white shadow-[0_28px_70px_-42px_rgba(3,0,75,0.9)]">
      <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_88%_0%,rgba(255,222,171,0.28),transparent_33%),linear-gradient(120deg,#09063f_0%,#17105e_100%)] px-5 py-8 md:px-9 md:py-10">
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full border border-white/10" />
        <div className="absolute -bottom-8 -left-2 h-28 w-28 rounded-full border border-secondary-fixed/30" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary-fixed/30 bg-secondary-fixed/10 px-3 py-1.5 text-[11px] font-bold text-secondary-fixed">
              <Sparkles size={14} />
              نقشه اختصاصی مسیر یادگیری
            </div>
            <h2 className="text-2xl font-black leading-relaxed md:text-3xl">سفر شما در «{title}»</h2>
            <p className="mt-3 text-sm leading-7 text-white/65">این مجموعه از چند ایستگاه مستقل تشکیل شده است. مرحله مناسب را انتخاب کنید و قدم‌به‌قدم مسیر تخصصی خود را بسازید.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-fixed text-primary"><Layers3 size={19} /></span>
            <div><p className="text-xl font-black">{children.length.toLocaleString("fa-IR")}</p><p className="text-[10px] text-white/55">مرحله آموزشی</p></div>
          </div>
        </div>
      </div>

      <div className="relative px-4 py-5 sm:px-6 md:px-9 md:py-8">
        <div className="absolute bottom-8 right-9 top-8 hidden w-px bg-gradient-to-b from-secondary-fixed via-white/20 to-transparent md:block" />
        <div className="space-y-4 md:space-y-5">
          {children.map((child, index) => {
            const isCompleted = child.scheduleStatus === "completed";
            const isUpcoming = child.scheduleStatus === "upcoming";
            return (
              <Link key={child.id} href={`/courses/${child.slug}`} className="group relative block rounded-2xl border border-white/10 bg-white/[0.045] p-3 transition duration-300 hover:-translate-y-1 hover:border-secondary-fixed/70 hover:bg-white/[0.09] hover:shadow-[0_18px_38px_-24px_rgba(255,222,171,0.65)] sm:p-4 md:mr-8">
                <span className={`absolute -right-[3.1rem] top-8 hidden h-5 w-5 rounded-full border-4 border-[#09063f] md:block ${isCompleted ? "bg-emerald-400" : "bg-secondary-fixed shadow-[0_0_0_5px_rgba(255,222,171,0.12)]"}`} />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:block">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-secondary-fixed ring-1 ring-white/10 sm:mb-2">{(index + 1).toLocaleString("fa-IR")}</div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${isCompleted ? "bg-emerald-400/15 text-emerald-200" : "bg-secondary-fixed/15 text-secondary-fixed"}`}>{isCompleted ? <Check size={12} /> : <CalendarDays size={12} />}{isCompleted ? "برگزار شده" : "آماده ثبت‌نام"}</span>
                  </div>
                  <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-white/10 sm:w-36">
                    {child.thumbnail ? <img src={child.thumbnail} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /> : <div className="flex h-full items-center justify-center text-white/35"><PlayCircle size={28} /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black leading-7 text-white md:text-lg">{child.title}</h3>{isUpcoming && child.startDate && <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/65">شروع {new Date(child.startDate).toLocaleDateString("fa-IR")}</span>}</div>
                    {child.instructor && <p className="mt-1 text-xs text-secondary-fixed/80">مدرس: {child.instructor}</p>}
                    {child.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/55">{child.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-left">
                    <div><p className="text-[10px] text-white/45">{child.registrationMode === "registration" ? "ثبت‌نام" : "هزینه دوره"}</p><p className="mt-1 text-sm font-black text-secondary-fixed">{child.registrationMode === "registration" ? "فرم درخواست" : `${formatPrice(child.price)} تومان`}</p></div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-fixed text-primary transition-transform group-hover:-translate-x-1"><ArrowUpLeft size={17} /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
