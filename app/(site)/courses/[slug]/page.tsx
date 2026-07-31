"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Star,
  Clock,
  User,
  Play,
  ShoppingCart,
  Loader2,
  ChevronRight,
  ImageIcon,
  CalendarDays,
  ClipboardEdit,
  CheckCircle2,
} from "lucide-react";
import { getCookie } from "@/lib/cookie";
import CourseRegistrationModal from "@/components/courses/course-registration-modal";
import ComprehensiveCoursePath from "@/components/courses/comprehensive-course-path";
import CopyLinkButton from "@/components/ui/copy-link-button";
import toast from "react-hot-toast";

interface GalleryImage {
  id: string;
  imageUrl: string;
  altText?: string;
}

interface CourseImage {
  id: string;
  url: string;
  alt?: string;
}

interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  oldPrice?: number;
  instructor?: string;
  categoryName?: string;
  level?: string;
  thumbnail?: string;
  duration?: string;
  rating: number;
  ratingCount: number;
  gallery: GalleryImage[];
  images?: CourseImage[];
  _count: { enrollments: number };
  courseType: "comprehensive" | "single";
  scheduleStatus: "upcoming" | "completed";
  startDate?: string | null;
  endDate?: string | null;
  registrationMode: "purchase" | "registration";
  parent?: { id: string; title: string; slug: string } | null;
  children?: Array<{ id: string; title: string; slug: string; thumbnail?: string | null; description?: string; instructor?: string | null; price: number; registrationMode: "purchase" | "registration"; scheduleStatus: string; startDate?: string | null; endDate?: string | null }>;
}

function formatPrice(price: number) {
  return price.toLocaleString("fa-IR");
}

function getLevelLabel(level?: string) {
  switch (level) {
    case "beginner":
      return "مقدماتی";
    case "intermediate":
      return "پیشرفته";
    case "advanced":
      return "تخصصی";
    default:
      return level || "عمومی";
  }
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [courseImages, setCourseImages] = useState<CourseImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [applicationSent, setApplicationSent] = useState(false);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const listRes = await fetch("/api/courses");
        const listData = await listRes.json();
        const courses: Array<{ id: string; slug: string }> =
          listData.courses || [];
        const found = courses.find((c) => c.slug === slug);

        if (!found) {
          setNotFound(true);
          return;
        }

        const [detailRes, imagesRes] = await Promise.all([
          fetch(`/api/courses/${found.id}`),
          fetch(`/api/courses/${found.id}/images`).catch(() => null),
        ]);
        if (!detailRes.ok) {
          setNotFound(true);
          return;
        }
        const detailData = await detailRes.json();
        setCourse(detailData.course);

        if (imagesRes && imagesRes.ok) {
          const imagesData = await imagesRes.json();
          setCourseImages(imagesData.images || []);
        }

        const token = getCookie("token");
        if (token) {
          const enrollRes = await fetch(
            `/api/enroll?courseId=${found.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ).catch(() => null);
          if (enrollRes && enrollRes.ok) {
            const enrollData = await enrollRes.json();
            if (enrollData.enrolled) {
              setIsEnrolled(true);
            }
          }
          const applicationRes = await fetch("/api/course-applications", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
          if (applicationRes?.ok) { const applicationData = await applicationRes.json(); const application = applicationData.applications?.find((item: { courseId: string }) => item.courseId === found.id); if (application) setApplicationStatus(application.status); }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center pt-24">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center pt-24">
        <p className="text-outline text-lg mb-4">دوره مورد نظر یافت نشد</p>
        <button
          onClick={() => router.push("/courses")}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-container transition-all"
        >
          بازگشت به دوره‌ها
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8">
        <button
          onClick={() => router.push("/courses")}
          className="flex items-center gap-1 text-outline hover:text-primary transition-colors mb-6 text-sm"
        >
          <ChevronRight size={16} />
          بازگشت به دوره‌ها
        </button>

        <div className="course-detail-layout grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-primary mb-6 sm:aspect-[16/10]">
              {course.thumbnail ? (
                <><div className="absolute inset-0 scale-110 bg-cover bg-center opacity-45 blur-2xl" style={{ backgroundImage: `url(${course.thumbnail})` }} /><img src={course.thumbnail} alt={course.title} className="relative h-full w-full object-contain" /></>
              ) : (
                <div className="w-full h-full bg-surface-variant flex items-center justify-center">
                  <ImageIcon size={48} className="text-outline-variant" />
                </div>
              )}
            </div>

            {courseImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-6">
                {courseImages.map((img) => (
                  <div
                    key={img.id}
                    className="aspect-video rounded-xl overflow-hidden bg-surface-variant"
                  >
                    <div
                      className="w-full h-full bg-cover bg-center hover:scale-110 transition-transform duration-500"
                      style={{ backgroundImage: `url(${img.url})` }}
                      title={img.alt || ""}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {course.parent && <button onClick={() => router.push(`/courses/${course.parent?.slug}`)} className="bg-primary text-secondary-fixed text-xs font-bold px-3 py-1 rounded-full">زیرمجموعه {course.parent.title}</button>}
              {course.categoryName && (
                <span className="bg-secondary-fixed/30 text-secondary text-xs font-bold px-3 py-1 rounded-full">
                  {course.categoryName}
                </span>
              )}
              {course.level && (
                <span className="bg-surface-variant text-outline text-xs font-bold px-3 py-1 rounded-full">
                  {getLevelLabel(course.level)}
                </span>
              )}
              {course.duration && (
                <span className="flex items-center gap-1 text-outline text-xs">
                  <Clock size={14} />
                  {course.duration}
                </span>
              )}
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${course.scheduleStatus === "completed" ? "bg-surface-container text-outline" : "bg-blue-50 text-blue-700"}`}>{course.scheduleStatus === "completed" ? "برگزار شده" : `شروع: ${course.startDate ? new Date(course.startDate).toLocaleDateString("fa-IR") : "به‌زودی"}`}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h1 className="text-2xl md:text-3xl font-bold text-primary">{course.title}</h1><CopyLinkButton path={`/courses/${course.slug}`} /></div>

            {course.instructor && (
              <div className="flex items-center gap-2 text-outline mb-4">
                <User size={16} />
                <span className="text-sm">{course.instructor}</span>
              </div>
            )}

            <div className="flex items-center gap-1 text-secondary mb-6">
              <Star size={16} className="fill-current" />
              <span className="font-bold">{course.rating}</span>
              <span className="text-outline text-sm">
                ({course.ratingCount.toLocaleString("fa-IR")} رای)
              </span>
              <span className="text-outline text-sm mr-3">
                {course._count.enrollments.toLocaleString("fa-IR")} دانشجو
              </span>
            </div>

            {course.courseType === "comprehensive" && <ComprehensiveCoursePath title={course.title} children={course.children || []} />}
            <div className="prose prose-sm max-w-none text-on-background leading-relaxed whitespace-pre-line">
              {course.description}
            </div>
            {course.courseType === "comprehensive" && <section className="mt-10 rounded-[2rem] border border-secondary-fixed/60 bg-gradient-to-br from-[#fffdf8] to-[#f8f5ff] p-5 md:p-7"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-secondary-fixed/50 pb-5"><div><p className="text-xs font-bold text-secondary">مسیر یادگیری این مجموعه</p><h2 className="mt-2 text-2xl font-black text-primary">زیر‌دوره‌ها و زمان‌بندی</h2><p className="mt-2 text-sm text-outline">هر زیر‌دوره به‌صورت مستقل ثبت‌نام و خریداری می‌شود.</p></div><span className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-secondary-fixed">{(course.children?.length || 0).toLocaleString("fa-IR")} زیر‌دوره</span></div>{course.children?.length ? <div className="mt-5 space-y-4">{course.children.map((child, index) => <button key={child.id} onClick={() => router.push(`/courses/${child.slug}`)} className="group flex w-full flex-col gap-4 rounded-2xl border border-outline-variant/40 bg-white p-4 text-right transition hover:-translate-y-0.5 hover:border-secondary hover:shadow-lg sm:flex-row sm:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-secondary-fixed">{(index + 1).toLocaleString("fa-IR")}</div><div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-surface-low sm:w-32">{child.thumbnail ? <img src={child.thumbnail} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-xs text-outline">تصویر ندارد</div>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-primary">{child.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${child.scheduleStatus === "completed" ? "bg-surface-container text-outline" : "bg-blue-50 text-blue-700"}`}>{child.scheduleStatus === "completed" ? "برگزار شده" : "در انتظار برگزاری"}</span></div>{child.instructor && <p className="mt-1 text-xs text-outline">مدرس: {child.instructor}</p>}{child.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-outline">{child.description}</p>}</div><div className="flex shrink-0 flex-col gap-2 sm:items-end"><span className="text-xs text-outline">{child.startDate ? `شروع: ${new Date(child.startDate).toLocaleDateString("fa-IR")}` : "تاریخ به‌زودی اعلام می‌شود"}</span><span className="font-black text-primary">{formatPrice(child.price)} <span className="text-xs font-normal">تومان</span></span><span className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">{child.registrationMode === "registration" ? "ثبت‌نام مستقل" : "مشاهده و خرید"}</span></div></button>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-outline-variant bg-white/70 p-8 text-center text-sm text-outline">زیر‌دوره‌ای برای این مجموعه ثبت نشده است.</div>}</section>}
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-lg border border-outline-variant/30 p-6 sticky top-28">
              {course.courseType === "comprehensive" ? <div className="text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-primary"><CalendarDays size={25} /></div><h3 className="font-black text-primary">مجموعه معرفی دوره‌ها</h3><p className="mt-3 text-sm leading-7 text-outline">ثبت‌نام این مجموعه انجام نمی‌شود. زیر‌دوره مناسب را از فهرست بالا انتخاب و جداگانه اقدام کنید.</p><div className="mt-5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white">انتخاب زیر‌دوره</div></div> : <>
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black text-primary">
                    {formatPrice(course.price)}
                  </span>
                  <span className="text-outline text-sm">تومان</span>
                </div>
                {course.oldPrice && course.oldPrice > course.price && (
                  <span className="text-outline line-through text-sm">
                    {formatPrice(course.oldPrice)} تومان
                  </span>
                )}
              </div>

              {course.scheduleStatus === "completed" ? <button disabled className="w-full bg-surface-variant text-outline py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3"><CheckCircle2 size={18} />این دوره به پایان رسیده است</button> : isEnrolled ? (
                <button className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-secondary-container hover:text-on-secondary-fixed transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3">
                  <Play size={18} />
                  ادامه یادگیری
                </button>
              ) : course.registrationMode === "registration" ? applicationStatus ? <div className={`w-full py-3 rounded-xl font-bold text-center mb-3 ${applicationStatus === "approved" ? "bg-green-50 text-green-700" : applicationStatus === "rejected" ? "bg-error-container text-error" : "bg-yellow-50 text-yellow-700"}`}>{applicationStatus === "approved" ? "درخواست شما تأیید شده" : applicationStatus === "rejected" ? "درخواست شما رد شده" : "درخواست شما در انتظار بررسی است"}</div> : <button onClick={() => { if (!getCookie("token")) { router.push(`/login?redirect=${encodeURIComponent(`/courses/${slug}`)}`); return; } setRegistrationOpen(true); }} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3"><ClipboardEdit size={18} />تکمیل فرم ثبت‌نام</button> : <button onClick={() => toast("اتصال به درگاه خرید در مرحله بعد انجام می‌شود")} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3"><ShoppingCart size={18} />خرید و ثبت‌نام</button>}

               <p className="text-xs text-outline text-center">
                 تضمین کیفیت آموزش
               </p>
              </>}
            </div>

            {course.gallery && course.gallery.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-primary mb-4">گالری تصاویر</h3>
                <div className="grid grid-cols-2 gap-3">
                  {course.gallery.map((img: GalleryImage) => (
                    <div
                      key={img.id}
                      className="aspect-video rounded-xl overflow-hidden bg-surface-variant"
                    >
                      <div
                        className="w-full h-full bg-cover bg-center hover:scale-110 transition-transform duration-500"
                        style={{ backgroundImage: `url(${img.imageUrl})` }}
                        title={img.altText || ""}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {registrationOpen && <CourseRegistrationModal courseId={course.id} courseTitle={course.title} onClose={() => setRegistrationOpen(false)} onSuccess={(profileUpdated) => { setRegistrationOpen(false); setApplicationStatus("pending"); setApplicationSent(true); if (profileUpdated) toast.success("نام، ایمیل یا موبایل حساب کاربری شما نیز بروزرسانی شد"); }} />}
      {applicationSent && <div className="modal-overlay" onClick={() => setApplicationSent(false)}><div className="modal-content max-w-md text-center" onClick={(event) => event.stopPropagation()}><div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto"><CheckCircle2 size={30} /></div><h2 className="text-xl font-black text-primary mt-5">درخواست شما ثبت شد</h2><p className="text-sm text-outline leading-7 mt-2">اطلاعات شما برای دوره «{course.title}» ارسال شد و پس از بررسی، وضعیت آن در پنل کاربری قابل مشاهده است.</p><button onClick={() => setApplicationSent(false)} className="mt-6 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold">متوجه شدم</button></div></div>}
    </div>
  );
}
