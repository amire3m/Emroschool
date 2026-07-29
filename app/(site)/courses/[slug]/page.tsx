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
} from "lucide-react";
import { getCookie } from "@/lib/cookie";

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
  category?: string;
  level?: string;
  thumbnail?: string;
  duration?: string;
  rating: number;
  ratingCount: number;
  gallery: GalleryImage[];
  images?: CourseImage[];
  _count: { enrollments: number };
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="relative aspect-[21/9] rounded-2xl overflow-hidden mb-6">
              {course.thumbnail ? (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${course.thumbnail})` }}
                />
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
              {course.category && (
                <span className="bg-secondary-fixed/30 text-secondary text-xs font-bold px-3 py-1 rounded-full">
                  {course.category}
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
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-primary mb-3">
              {course.title}
            </h1>

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

            <div className="prose prose-sm max-w-none text-on-background leading-relaxed whitespace-pre-line">
              {course.description}
            </div>
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-lg border border-outline-variant/30 p-6 sticky top-28">
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

              {isEnrolled ? (
                <button className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-secondary-container hover:text-on-secondary-fixed transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3">
                  <Play size={18} />
                  ادامه یادگیری
                </button>
              ) : (
                <button className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3">
                  <ShoppingCart size={18} />
                  خرید و ثبت‌نام
                </button>
              )}

              <p className="text-xs text-outline text-center">
                تضمین کیفیت آموزش
              </p>
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
    </div>
  );
}
