"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import CourseCurriculum, {
  createCourseCurriculumView,
  type CourseCurriculumData,
} from "@/components/courses/course-curriculum";
import CopyLinkButton from "@/components/ui/copy-link-button";
import toast from "react-hot-toast";
import { useInitialData } from "@/components/seo/initial-data-provider";
import {
  commitCurrentCourseRefreshState,
  createCourseRefreshOwner,
  createCourseRefreshState,
  finishCourseRefreshFailure,
  registrationActionPlacement,
  startIndependentCourseRefreshes,
  type CourseRefreshState,
} from "@/lib/course-detail-refresh";

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

interface CourseDetailBase {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  oldPrice?: number;
  instructor?: string;
  instructorProfile?: {
    id: string;
    profileSlug?: string | null;
    name?: string | null;
    avatar?: string | null;
    bio?: string | null;
    expertise?: string | null;
    user?: {
      id: string;
      name: string;
      avatar?: string | null;
      bio?: string | null;
      expertise?: string | null;
    } | null;
  } | null;
  instructors?: Array<{ instructor: {
    id: string;
    profileSlug?: string | null;
    name?: string | null;
    avatar?: string | null;
    expertise?: string | null;
    user?: { id: string; name: string; avatar?: string | null; expertise?: string | null } | null;
  } }>;
  categoryName?: string;
  level?: string;
  thumbnail?: string;
  duration?: string;
  rating: number;
  ratingCount: number;
  gallery: GalleryImage[];
  images?: CourseImage[];
  _count: { enrollments: number };
  enrollments?: Array<{ id: string; user: { id: string; name: string; avatar?: string | null; expertise?: string | null } }>;
  courseType: "comprehensive" | "single";
  scheduleStatus: "upcoming" | "completed";
  startDate?: string | null;
  endDate?: string | null;
  deliveryModes?: string;
  parent?: { id: string; title: string; slug: string } | null;
  prerequisite?: { id: string; title: string; slug: string } | null;
  children?: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnail?: string | null;
    description?: string;
    instructor?: string | null;
    price: number;
    scheduleStatus: string;
    startDate?: string | null;
    endDate?: string | null;
  }>;
}

type CourseDetail = CourseDetailBase & CourseCurriculumData;

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

  const initialCourse = useInitialData<CourseDetail>("course");
  const [refreshState, setRefreshState] = useState<
    CourseRefreshState<CourseDetail, CourseImage>
  >(() =>
    createCourseRefreshState<CourseDetail, CourseImage>(slug, initialCourse),
  );
  const {
    course,
    courseImages,
    loading,
    notFound,
    error: refreshError,
    isEnrolled,
    applicationStatus,
    applicationId,
    registrationOpen,
    curriculumRefreshing,
  } = refreshState;

  useEffect(() => {
    const baseline = createCourseRefreshState<CourseDetail, CourseImage>(
      slug,
      initialCourse,
    );
    const owner = createCourseRefreshOwner(slug);
    setRefreshState(baseline);

    const updateCurrent = (
      updates: Partial<CourseRefreshState<CourseDetail, CourseImage>>,
    ) => {
      if (!owner.isCurrent(slug)) return false;
      setRefreshState((current) =>
        commitCurrentCourseRefreshState(owner, slug, current, updates),
      );
      return true;
    };

    const failCurrent = (authoritativeNotFound: boolean) => {
      if (!owner.isCurrent(slug)) return;
      const failure = finishCourseRefreshFailure(
        baseline,
        authoritativeNotFound,
      );
      setRefreshState((current) =>
        commitCurrentCourseRefreshState(owner, slug, current, failure),
      );
    };

    async function fetchCourse() {
      try {
        const listRes = await fetch("/api/courses", { signal: owner.signal });
        if (!owner.isCurrent(slug)) return;
        if (!listRes.ok) throw new Error("Course list refresh failed");
        const listData = await listRes.json();
        if (!owner.isCurrent(slug)) return;
        const courses: Array<{ id: string; slug: string }> = Array.isArray(
          listData.courses,
        )
          ? listData.courses
          : [];
        const found = courses.find((candidate) => candidate.slug === slug);

        if (!found) {
          failCurrent(false);
          return;
        }
        const courseId = found.id;

        const token = getCookie("token");
        const [detailRes, imagesRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: owner.signal,
          }),
          fetch(`/api/courses/${courseId}/images`, {
            signal: owner.signal,
          }).catch(() => null),
        ]);
        if (!owner.isCurrent(slug)) return;
        if (detailRes.status === 404) {
          failCurrent(true);
          return;
        }
        if (!detailRes.ok) throw new Error("Course detail refresh failed");
        const detailData = await detailRes.json();
        if (!owner.isCurrent(slug)) return;
        if (!detailData.course || detailData.course.slug !== slug) {
          throw new Error("Course detail refresh returned the wrong course");
        }
        updateCurrent({
          course: detailData.course,
          loading: false,
          notFound: false,
          error: false,
          curriculumRefreshing: false,
        });

        if (imagesRes?.ok) {
          const imagesData = await imagesRes.json().catch(() => null);
          if (!owner.isCurrent(slug)) return;
          if (imagesData) {
            updateCurrent({ courseImages: imagesData.images || [] });
          }
        }

        if (token) {
          async function refreshEnrollment() {
            try {
              const enrollRes = await fetch(
                `/api/enroll?courseId=${courseId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                  signal: owner.signal,
                },
              );
              if (!owner.isCurrent(slug) || !enrollRes.ok) return;
              const enrollData = await enrollRes.json();
              if (!owner.isCurrent(slug)) return;
              updateCurrent({ isEnrolled: Boolean(enrollData.enrolled) });
            } catch {
              // Enrollment is optional page enhancement; the locked baseline is safe.
            }
          }

          async function refreshApplication() {
            try {
              const applicationRes = await fetch("/api/course-applications", {
                headers: { Authorization: `Bearer ${token}` },
                signal: owner.signal,
              });
              if (!owner.isCurrent(slug) || !applicationRes.ok) return;
              const applicationData = await applicationRes.json();
              if (!owner.isCurrent(slug)) return;
              const application = applicationData?.applications?.find(
                (item: { courseId: string; id: string; status: string }) =>
                  item.courseId === courseId,
              );
              if (application) {
                updateCurrent({
                  applicationId: application.id,
                  applicationStatus: application.status,
                });
              }
            } catch {
              // Application state is independent from enrollment access.
            }
          }

          startIndependentCourseRefreshes({
            enrollment: refreshEnrollment,
            application: refreshApplication,
          });
        }
      } catch {
        if (!owner.isCurrent(slug)) return;
        failCurrent(false);
      } finally {
        if (!owner.isCurrent(slug)) return;
        updateCurrent({ loading: false, curriculumRefreshing: false });
      }
    }
    fetchCourse();
    return () => owner.cancel();
  }, [initialCourse, slug]);

  if (refreshState.slug !== slug || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center pt-32">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (refreshError && !course) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center pt-32">
        <p className="text-outline text-lg mb-4">
          دریافت اطلاعات دوره انجام نشد
        </p>
        <button
          onClick={() => router.push("/courses")}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-container transition-all"
        >
          بازگشت به دوره‌ها
        </button>
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center pt-32">
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

  const courseInstructors = course.instructors?.map((assignment) => assignment.instructor) || (course.instructorProfile ? [course.instructorProfile] : []);
  const curriculumView = curriculumRefreshing
    ? ({ state: "hidden" } as const)
    : createCourseCurriculumView(course);
  const registrationPlacement = registrationActionPlacement(
    curriculumRefreshing,
    curriculumView.state,
  );
  const registrationAction = course.courseType === "single" ? (
    course.scheduleStatus === "completed" ? (
      <button
        disabled
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-variant py-3 font-bold text-outline"
      >
        <CheckCircle2 size={18} />
        این دوره به پایان رسیده است
      </button>
    ) : isEnrolled ? (
      <button className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 font-bold text-white transition-colors hover:bg-secondary-container hover:text-on-secondary-fixed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
        <Play size={18} />
        ادامه یادگیری
      </button>
    ) : ["pending", "pending_payment"].includes(applicationStatus || "") &&
      applicationId ? (
      <button
        onClick={() => router.push(`/invoice?application=${applicationId}`)}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white transition-colors hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ShoppingCart size={18} />
        مشاهده فاکتور و پرداخت
      </button>
    ) : applicationStatus ? (
      <div
        className={`mb-3 w-full rounded-xl py-3 text-center font-bold ${applicationStatus === "approved" ? "bg-green-50 text-green-700" : applicationStatus === "rejected" ? "bg-error-container text-error" : "bg-yellow-50 text-yellow-700"}`}
      >
        {applicationStatus === "approved"
          ? "درخواست شما تأیید شده"
          : applicationStatus === "rejected"
            ? "درخواست شما رد شده"
            : "درخواست شما در انتظار بررسی است"}
      </div>
    ) : (
      <button
        onClick={() => {
          if (!getCookie("token")) {
            router.push(
              `/login?redirect=${encodeURIComponent(`/courses/${slug}`)}`,
            );
            return;
          }
          setRefreshState((current) =>
            current.slug === slug
              ? { ...current, registrationOpen: true }
              : current,
          );
        }}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white transition-colors hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ClipboardEdit size={18} />
        تکمیل فرم ثبت‌نام
      </button>
    )
  ) : null;

  return (
    <div className="min-h-screen pt-32 pb-16">
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
                <>
                  <div
                    className="absolute inset-0 scale-110 bg-cover bg-center opacity-45 blur-2xl"
                    style={{ backgroundImage: `url(${course.thumbnail})` }}
                  />
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="relative h-full w-full object-contain"
                  />
                </>
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
              {course.parent && (
                <button
                  onClick={() => router.push(`/courses/${course.parent?.slug}`)}
                  className="bg-primary text-secondary-fixed text-xs font-bold px-3 py-1 rounded-full"
                >
                  زیرمجموعه {course.parent.title}
                </button>
              )}
              {course.prerequisite && <button onClick={() => router.push(`/courses/${course.prerequisite?.slug}`)} className="bg-orange-50 text-xs font-bold text-orange-700 px-3 py-1 rounded-full">پیش‌نیاز: {course.prerequisite.title}</button>}
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
              {(course.deliveryModes || "in_person").split(",").map((mode) => <span key={mode} className="rounded-full bg-primary text-[11px] font-bold text-secondary-fixed px-3 py-1">{mode === "virtual" ? "مجازی" : "حضوری"}</span>)}
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${course.scheduleStatus === "completed" ? "bg-surface-container text-outline" : "bg-blue-50 text-blue-700"}`}
              >
                {course.scheduleStatus === "completed"
                  ? "برگزار شده"
                  : `شروع: ${course.startDate ? new Date(course.startDate).toLocaleDateString("fa-IR") : "به‌زودی"}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h1 className="text-2xl md:text-3xl font-bold text-primary">
                {course.title}
              </h1>
              <CopyLinkButton path={`/courses/${course.slug}`} />
            </div>

            {courseInstructors.length ? (
              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                {courseInstructors.map((instructor) => {
                  const name = instructor.name || instructor.user?.name || "مدرس دوره";
                  return <Link key={instructor.id} href={`/instructors/${instructor.profileSlug || instructor.id}`} className="flex items-center gap-4 rounded-2xl border border-secondary-fixed/60 bg-[#fffaf0] p-4 transition hover:border-secondary hover:shadow-md">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-surface-variant">{instructor.avatar || instructor.user?.avatar ? <img src={instructor.avatar || instructor.user?.avatar || ""} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-outline"><User size={24} /></div>}</div>
                    <div className="min-w-0"><p className="text-xs font-bold text-secondary">مدرس دوره</p><h2 className="mt-1 truncate font-black text-primary">{name}</h2>{(instructor.expertise || instructor.user?.expertise) && <p className="mt-1 truncate text-sm text-outline">{instructor.expertise || instructor.user?.expertise}</p>}</div>
                  </Link>;
                })}
              </div>
            ) : (
              course.instructor && (
                <div className="mb-4 flex items-center gap-2 text-outline">
                  <User size={16} />
                  <span className="text-sm">{course.instructor}</span>
                </div>
              )
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

            {course.courseType === "comprehensive" && (
              <ComprehensiveCoursePath
                title={course.title}
                children={course.children || []}
              />
            )}
            <div className="prose prose-sm max-w-none text-on-background leading-relaxed whitespace-pre-line">
              {course.description}
            </div>
            {curriculumRefreshing &&
            course.curriculumSummary.chapterCount > 0 ? (
              <section
                className="mt-10 rounded-2xl border border-outline-variant/40 bg-white p-6 text-sm text-outline shadow-sm"
                aria-live="polite"
              >
                در حال بررسی دسترسی شما به سرفصل‌های دوره...
              </section>
            ) : curriculumView.state === "locked" ? (
              <CourseCurriculum
                {...curriculumView}
                registrationAction={registrationAction}
              />
            ) : (
              <CourseCurriculum {...curriculumView} />
            )}
            {course.enrollments && course.enrollments.length > 0 && <section className="mt-10 overflow-hidden rounded-[2rem] border border-primary/10 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-surface-variant bg-surface-low px-5 py-4"><div><p className="text-xs font-bold text-secondary">جامعه یادگیری</p><h2 className="mt-1 text-xl font-black text-primary">دانشجویان این دوره</h2></div><span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-secondary-fixed">{course._count.enrollments.toLocaleString("fa-IR")} دانشجو</span></div><div className="grid gap-3 p-4 sm:grid-cols-2">{course.enrollments.map((enrollment) => <Link key={enrollment.id} href={`/profile/${enrollment.user.id}`} className="group flex items-center gap-3 rounded-2xl border border-surface-variant bg-white p-3 transition hover:-translate-y-0.5 hover:border-secondary hover:shadow-md"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-fixed text-primary">{enrollment.user.avatar ? <img src={enrollment.user.avatar} alt={enrollment.user.name} className="h-full w-full object-cover" /> : <User size={20} />}</div><div className="min-w-0"><p className="truncate text-sm font-black text-primary">{enrollment.user.name}</p>{enrollment.user.expertise && <p className="mt-1 truncate text-xs text-outline">{enrollment.user.expertise}</p>}</div></Link>)}</div>{course._count.enrollments > course.enrollments.length && <p className="px-5 pb-5 text-center text-xs text-outline">فقط دانشجویانی که پروفایل عمومی تأییدشده دارند نمایش داده می‌شوند.</p>}</section>}
            {course.courseType === "comprehensive" && (
              <section className="mt-10 rounded-[2rem] border border-secondary-fixed/60 bg-gradient-to-br from-[#fffdf8] to-[#f8f5ff] p-5 md:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-secondary-fixed/50 pb-5">
                  <div>
                    <p className="text-xs font-bold text-secondary">
                      مسیر یادگیری این مجموعه
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-primary">
                      زیر‌دوره‌ها و زمان‌بندی
                    </h2>
                    <p className="mt-2 text-sm text-outline">
                      هر زیر‌دوره به‌صورت مستقل ثبت‌نام و خریداری می‌شود.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-secondary-fixed">
                    {(course.children?.length || 0).toLocaleString("fa-IR")}{" "}
                    زیر‌دوره
                  </span>
                </div>
                {course.children?.length ? (
                  <div className="mt-5 space-y-4">
                    {course.children.map((child, index) => (
                      <button
                        key={child.id}
                        onClick={() => router.push(`/courses/${child.slug}`)}
                        className="group flex w-full flex-col gap-4 rounded-2xl border border-outline-variant/40 bg-white p-4 text-right transition hover:-translate-y-0.5 hover:border-secondary hover:shadow-lg sm:flex-row sm:items-center"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-secondary-fixed">
                          {(index + 1).toLocaleString("fa-IR")}
                        </div>
                        <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-surface-low sm:w-32">
                          {child.thumbnail ? (
                            <img
                              src={child.thumbnail}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-outline">
                              تصویر ندارد
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-primary">
                              {child.title}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold ${child.scheduleStatus === "completed" ? "bg-surface-container text-outline" : "bg-blue-50 text-blue-700"}`}
                            >
                              {child.scheduleStatus === "completed"
                                ? "برگزار شده"
                                : "در انتظار برگزاری"}
                            </span>
                          </div>
                          {child.instructor && (
                            <p className="mt-1 text-xs text-outline">
                              مدرس: {child.instructor}
                            </p>
                          )}
                          {child.description && (
                            <p className="mt-2 line-clamp-2 text-xs leading-6 text-outline">
                              {child.description}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                          <span className="text-xs text-outline">
                            {child.startDate
                              ? `شروع: ${new Date(child.startDate).toLocaleDateString("fa-IR")}`
                              : "تاریخ به‌زودی اعلام می‌شود"}
                          </span>
                          <span className="font-black text-primary">
                            {formatPrice(child.price)}{" "}
                            <span className="text-xs font-normal">تومان</span>
                          </span>
                          <span className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">
                            "فرم ثبت‌نام و پرداخت"
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-outline-variant bg-white/70 p-8 text-center text-sm text-outline">
                    زیر‌دوره‌ای برای این مجموعه ثبت نشده است.
                  </div>
                )}
              </section>
            )}
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-lg border border-outline-variant/30 p-6 sticky top-28">
              {course.courseType === "comprehensive" ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-primary">
                    <CalendarDays size={25} />
                  </div>
                  <h3 className="font-black text-primary">
                    مجموعه معرفی دوره‌ها
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-outline">
                    ثبت‌نام این مجموعه انجام نمی‌شود. زیر‌دوره مناسب را از فهرست
                    بالا انتخاب و جداگانه اقدام کنید.
                  </p>
                  <div className="mt-5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white">
                    انتخاب زیر‌دوره
                  </div>
                </div>
              ) : (
                <>
                  {course.price > 0 && <div className="mb-6">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-black text-primary">{formatPrice(course.price)}</span><span className="text-outline text-sm">تومان</span>
                    </div>
                    {course.oldPrice && course.oldPrice > course.price && (
                      <span className="text-outline line-through text-sm">
                        {formatPrice(course.oldPrice)} تومان
                      </span>
                    )}
                  </div>}

                  {registrationPlacement === "sidebar" && registrationAction}

                  <p className="text-xs text-outline text-center">
                    تضمین کیفیت آموزش
                  </p>
                </>
              )}
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
      {registrationOpen && (
        <CourseRegistrationModal
          courseId={course.id}
          courseTitle={course.title}
          onClose={() =>
            setRefreshState((current) => ({
              ...current,
              registrationOpen: false,
            }))
          }
          onSuccess={({
            applicationId: createdApplicationId,
            profileUpdated,
          }) => {
            if (profileUpdated)
              toast.success(
                "نام، ایمیل یا موبایل حساب کاربری شما نیز بروزرسانی شد",
              );
            router.push(`/invoice?application=${createdApplicationId}`);
          }}
        />
      )}
    </div>
  );
}
