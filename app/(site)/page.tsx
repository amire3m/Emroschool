"use client";

import { useState, useEffect, useRef, ReactNode, useCallback } from "react";
import Link from "next/link";
import { HomeSectionContent, parseHomeSectionContent } from "@/lib/home-sections";
import {
  Film,
  Palette,
  Newspaper,
  BookOpen,
  Video,
  Camera,
  Star,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
  X,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

const departments = [
  { name: "سینما", icon: Film },
  { name: "گرافیک", icon: Palette },
  { name: "رسانه", icon: Newspaper },
  { name: "فلسفه هنر", icon: BookOpen },
  { name: "انیمیشن", icon: Video },
  { name: "عکاسی", icon: Camera },
];

interface HomeInstructor {
  id: string;
  name: string | null;
  avatar: string | null;
  expertise: string | null;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  price: number;
  oldPrice?: number;
  instructor?: string;
  categoryName?: string;
  thumbnail?: string;
  rating: number;
  ratingCount: number;
  featured?: boolean;
}

interface PageSection {
  slug: string;
  content: string;
  order: number;
  visible: boolean;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  altText: string;
  folder: string;
  courseId: string;
  createdAt: string;
}

interface SliderItem {
  id: string;
  title?: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  linkText?: string;
  order: number;
  published: boolean;
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function AnimatedSection({
  children,
  className = "",
  order,
}: {
  children: ReactNode;
  className?: string;
  order?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{ order }}
      className={`${className} transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {children}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-secondary">
      <Star size={14} className="fill-current" />
      <span className="font-bold text-sm">{rating}</span>
    </div>
  );
}

function formatPrice(price: number) {
  return price.toLocaleString("fa-IR");
}

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [homeInstructors, setHomeInstructors] = useState<HomeInstructor[]>([]);
  const [email, setEmail] = useState("");
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [sliders, setSliders] = useState<SliderItem[]>([]);
  const [slidersLoading, setSlidersLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideInterval = useRef<ReturnType<typeof setInterval>>();
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});
  const [sectionOrder, setSectionOrder] = useState<Record<string, number>>({});
  const [sectionContent, setSectionContent] = useState<Record<string, HomeSectionContent>>({});
  const [partners, setPartners] = useState<{ id: string; name: string; logoUrl: string }[]>([]);

  const scrollRefs = {
    departments: useRef<HTMLDivElement>(null),
    instructors: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/courses");
        const data = await res.json();
        setCourses(data.courses || []);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchGallery() {
      try {
        const res = await fetch("/api/gallery");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setGalleryItems(data.images || []);
      } catch {
        setGalleryError(true);
      } finally {
        setGalleryLoading(false);
      }
    }
    fetchGallery();
  }, []);

  useEffect(() => {
    async function fetchSliders() {
      try {
        const res = await fetch("/api/slider");
        const data = await res.json();
        setSliders(data.slides || []);
      } catch {
      } finally {
        setSlidersLoading(false);
      }
    }
    fetchSliders();
  }, []);

  useEffect(() => {
    fetch("/api/page-builder")
      .then((r) => r.json())
      .then((data) => {
        const vis: Record<string, boolean> = {};
        const orders: Record<string, number> = {};
        const contents: Record<string, HomeSectionContent> = {};
        (data.sections || []).forEach((s: PageSection) => {
          vis[s.slug] = s.visible;
          orders[s.slug] = s.order;
          contents[s.slug] = parseHomeSectionContent(s.slug, s.content);
        });
        setSectionVisibility(vis);
        setSectionOrder(orders);
        setSectionContent(contents);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/partners")
      .then((r) => r.json())
      .then((data) => setPartners(data.partners || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/instructors")
      .then((r) => r.json())
      .then((data) => {
        const all = data.instructors || [];
        const visible = all.filter((i: { showOnSite: boolean }) => i.showOnSite !== false);
        setHomeInstructors(visible);
      })
      .catch(() => {});
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % Math.max(sliders.length, 1));
  }, [sliders.length]);

  useEffect(() => {
    if (sliders.length <= 1) return;
    slideInterval.current = setInterval(nextSlide, 5000);
    return () => clearInterval(slideInterval.current);
  }, [sliders.length, nextSlide]);

  useEffect(() => {
    if (lightbox) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  const contentFor = (slug: string) => sectionContent[slug] || parseHomeSectionContent(slug);
  const orderFor = (slug: string, fallback: number) => sectionOrder[slug] ?? fallback;
  const numberValue = (value: string | number, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  const heroContent = contentFor("hero");
  const departmentsContent = contentFor("departments");
  const coursesContent = contentFor("courses");
  const instructorsContent = contentFor("instructors");
  const galleryContent = contentFor("gallery");
  const partnersContent = contentFor("partners");
  const ctaContent = contentFor("cta");
  const courseLimit = numberValue(coursesContent.limit, 4) || 4;
  const instructorLimit = numberValue(instructorsContent.limit, 0);
  const galleryLimit = numberValue(galleryContent.limit, 0);
  const featured = courses.filter((c) => c.featured).slice(0, courseLimit);
  const displayCourses = featured.length > 0 ? featured : courses.slice(0, courseLimit);
  const displayInstructors = instructorLimit > 0 ? homeInstructors.slice(0, instructorLimit) : homeInstructors;
  const displayGallery = galleryLimit > 0 ? galleryItems.slice(0, galleryLimit) : galleryItems;

  return (
    <div className="flex flex-col">
      <div style={{ order: orderFor("hero", 1) }}>
      {sectionVisibility.hero !== false && (
        slidersLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-primary">
          <Loader2 size={40} className="animate-spin text-secondary" />
        </div>
      ) : sliders.length > 0 ? (
        <section className="relative min-h-screen overflow-hidden">
          {sliders.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div
                className="w-full h-full bg-cover bg-center scale-105"
                style={{
                  backgroundImage: `url(${slide.imageUrl})`,
                  transform: index === currentSlide ? "scale(1)" : "scale(1.05)",
                  transition: "transform 10s ease-out",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-l from-primary via-primary/80 to-primary/60" />
              <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
            </div>
          ))}

          <div className="relative z-10 w-full min-h-screen flex items-center">
            <div className="w-full max-w-[1280px] mx-auto px-5 md:px-8 text-right">
              <div className="max-w-3xl relative min-h-[300px]">
                {sliders.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`transition-all duration-700 absolute w-full ${
                      index === currentSlide
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8 pointer-events-none"
                    }`}
                  >
                    {slide.title && (
                      <span className="inline-block px-4 py-1.5 bg-secondary/20 text-secondary-fixed border border-secondary/30 rounded-full text-sm font-bold mb-6">
                        {slide.title}
                      </span>
                    )}
                    {slide.subtitle && (
                      <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl text-secondary-fixed mb-6 leading-tight">
                        {slide.subtitle}
                      </h1>
                    )}
                    {slide.linkUrl && (
                      <div className="flex flex-wrap gap-4 mt-8">
                        <Link
                          href={slide.linkUrl}
                          className="bg-gradient-to-l from-secondary to-secondary/90 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-secondary/20 transition-all active:scale-95"
                        >
                          {slide.linkText || "مشاهده بیشتر"}
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {sliders.length > 1 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
              {sliders.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? "bg-secondary-fixed w-8"
                      : "bg-secondary-fixed/40 hover:bg-secondary-fixed/60"
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <header className="relative min-h-screen flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div
              className="w-full h-full bg-cover bg-center scale-105"
              style={{
                backgroundImage: `url("${String(heroContent.imageUrl)}")`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-primary via-primary/80 to-primary/60" />
            <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
          </div>

          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-5 md:px-8 text-right">
            <div className="max-w-3xl animate-fade-in-up">
              <span className="inline-block px-4 py-1.5 bg-secondary/20 text-secondary-fixed border border-secondary/30 rounded-full text-sm font-bold mb-6">
                {heroContent.badge}
              </span>

              <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl text-secondary-fixed mb-6 leading-tight">
                {heroContent.title}
              </h1>

              <p className="text-surface-variant text-base md:text-lg max-w-xl mb-8 leading-relaxed">
                {heroContent.description}
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href={String(heroContent.primaryUrl)}
                  className="bg-gradient-to-l from-secondary to-secondary/90 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-secondary/20 transition-all active:scale-95"
                >
                  {heroContent.primaryText}
                </Link>
                <a
                  href={String(heroContent.secondaryUrl)}
                  className="border border-secondary-fixed text-secondary-fixed px-8 py-4 rounded-xl font-bold text-lg hover:bg-secondary-fixed/10 transition-all"
                >
                  {heroContent.secondaryText}
                </a>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-secondary-fixed/50 animate-bounce">
            <ChevronDown size={32} />
          </div>
        </header>
      ))}
      </div>

      {sectionVisibility.departments !== false && (
      <AnimatedSection order={orderFor("departments", 2)} className="py-20 md:py-24">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl md:text-4xl text-primary mb-4">
              {departmentsContent.title}
            </h2>
            {departmentsContent.description && <p className="text-outline mt-2">{departmentsContent.description}</p>}
            <div className="w-24 h-1 bg-secondary mx-auto rounded-full" />
          </div>

          <div className="relative group/scroll">
            <div
              ref={scrollRefs.departments}
              className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scroll-smooth hide-scrollbar"
            >
                  {departments.map((dept) => {
                const Icon = dept.icon;
                return (
                  <Link
                    key={dept.name}
                    href={`/courses?category=${dept.name}`}
                    className="group bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-outline-variant hover:border-secondary hover:-translate-y-1 transition-all text-center cursor-pointer shrink-0 w-[160px] md:w-[180px] block"
                  >
                    <div className="mb-4 text-secondary flex justify-center">
                      <Icon size={40} className="group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="font-bold text-base text-primary">{dept.name}</h3>
                  </Link>
                );
              })}
            </div>
            <button
              onClick={() => { const el = scrollRefs.departments.current; if (el) el.scrollBy({ left: -300, behavior: "smooth" }); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-white shadow-md border border-surface-variant flex items-center justify-center text-primary opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-low z-10"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => { const el = scrollRefs.departments.current; if (el) el.scrollBy({ left: 300, behavior: "smooth" }); }}
              className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-white shadow-md border border-surface-variant flex items-center justify-center text-primary opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-low z-10"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>
      </AnimatedSection>
      )}

      {sectionVisibility.courses !== false && (
      <AnimatedSection order={orderFor("courses", 3)} className="py-20 md:py-24 bg-surface-low">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="font-playfair text-3xl md:text-4xl text-primary mb-2">
                {coursesContent.title}
              </h2>
              <p className="text-outline">{coursesContent.description}</p>
            </div>
            <Link
              href="/courses"
              className="text-secondary font-bold flex items-center gap-1 hover:gap-2 transition-all text-sm"
            >
              {coursesContent.linkText}
              <ChevronLeft size={18} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-secondary" />
            </div>
          ) : displayCourses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-outline-variant/30">
              <p className="text-outline text-lg mb-2">
                در حال حاضر دوره‌ای موجود نیست
              </p>
              <p className="text-outline-variant text-sm">به زودی...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-outline-variant/30"
                >
                  <div className="relative aspect-[9/16] overflow-hidden">
                    {course.thumbnail ? (
                      <div
                        className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
                        style={{
                          backgroundImage: `url(${course.thumbnail})`,
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-variant flex items-center justify-center">
                        <span className="text-outline-variant text-sm">
                          تصویر
                        </span>
                      </div>
                    )}
                    {course.categoryName && (
                      <div className="absolute top-3 right-3 bg-secondary-fixed text-primary text-xs font-bold px-2 py-1 rounded">
                        {course.categoryName}
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    {course.instructor && (
                      <p className="text-outline text-xs mb-1">
                        {course.instructor}
                      </p>
                    )}
                    <h4 className="font-bold text-primary text-sm md:text-base mb-2 line-clamp-2 leading-relaxed">
                      {course.title}
                    </h4>

                    <div className="flex items-center gap-1 text-secondary mb-3">
                      <StarRating rating={course.rating} />
                      <span className="text-outline text-xs">
                        ({course.ratingCount.toLocaleString("fa-IR")} رای)
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-outline-variant/20 pt-3">
                      <div className="flex flex-col">
                        {course.oldPrice && course.oldPrice > course.price && (
                          <span className="text-outline text-xs line-through">
                            {formatPrice(course.oldPrice)}
                          </span>
                        )}
                        <div className="text-primary font-black text-base md:text-lg">
                          {formatPrice(course.price)}{" "}
                          <span className="text-xs font-normal">تومان</span>
                        </div>
                      </div>
                      <div className="bg-primary/5 hover:bg-primary/10 p-2 rounded-full transition-colors">
                        <span className="text-primary text-sm font-bold">
                          مشاهده
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AnimatedSection>
      )}

      {sectionVisibility.instructors !== false && (
      <AnimatedSection order={orderFor("instructors", 4)} className="py-20 md:py-24">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="font-playfair text-3xl md:text-4xl text-primary mb-2">
                {instructorsContent.title}
              </h2>
              <p className="text-outline">{instructorsContent.description}</p>
            </div>
            <Link href="/instructors" className="text-secondary font-bold flex items-center gap-1 hover:gap-2 transition-all text-sm">
              {instructorsContent.linkText} <ChevronLeft size={18} />
            </Link>
          </div>
          {displayInstructors.length > 0 ? (
            <div className="relative group/scroll">
              <div
                ref={scrollRefs.instructors}
                className="flex gap-8 md:gap-12 overflow-x-auto pb-4 scroll-smooth hide-scrollbar"
              >
                {displayInstructors.map((instructor) => {
                  const instName = instructor.name || instructor.user?.name || "";
                  const instAvatar = instructor.avatar || instructor.user?.avatar || null;
                  return (
                  <Link key={instructor.id} href={instructor.user?.id ? `/profile/${instructor.user.id}` : "/instructors"} className="text-center group shrink-0 w-[200px]">
                    <div
                      className="relative w-36 h-36 mx-auto mb-5"
                      style={{
                        clipPath:
                          "polygon(0% 15%, 50% 0%, 100% 15%, 100% 100%, 0% 100%)",
                      }}
                    >
                      <div
                        className="w-full h-full bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${instAvatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=300&h=300&auto=format&fit=crop&crop=face"})`,
                        }}
                      />
                      <div className="absolute inset-0 bg-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-primary">
                          <span className="text-xs font-bold">پروفایل</span>
                        </div>
                      </div>
                    </div>
                    <h4 className="font-bold text-lg text-primary mb-1">{instName}</h4>
                    <p className="text-secondary text-sm">{instructor.expertise || "مدرس آکادمی"}</p>
                  </Link>
                )})}
              </div>
              <button
                onClick={() => { const el = scrollRefs.instructors.current; if (el) el.scrollBy({ left: -300, behavior: "smooth" }); }}
                className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-white shadow-md border border-surface-variant flex items-center justify-center text-primary opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-low z-10"
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={() => { const el = scrollRefs.instructors.current; if (el) el.scrollBy({ left: 300, behavior: "smooth" }); }}
                className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-white shadow-md border border-surface-variant flex items-center justify-center text-primary opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-surface-low z-10"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          ) : (
            <div className="text-center text-outline py-8">هنوز استادی ثبت نشده است</div>
          )}
        </div>
      </AnimatedSection>
      )}

      {sectionVisibility.gallery !== false && (
      <AnimatedSection order={orderFor("gallery", 5)} className="py-20 md:py-24 bg-surface-low">
        <div className="max-w-[1280px] mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl md:text-4xl text-primary mb-2">
              {galleryContent.title}
            </h2>
            <p className="text-outline">
              {galleryContent.description}
            </p>
          </div>

          {galleryLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-secondary" />
            </div>
          ) : galleryError ? (
            <div className="flex justify-center py-16">
              <div className="text-center">
                <AlertCircle size={32} className="text-outline mx-auto mb-2" />
                <p className="text-outline">خطا در بارگذاری گالری</p>
              </div>
            </div>
          ) : galleryItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-outline-variant/30">
              <ImageIcon size={40} className="text-outline-variant mx-auto mb-3" />
              <p className="text-outline text-lg">هنوز تصویری ثبت نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {displayGallery.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setLightbox(item.imageUrl)}
                  className="relative group rounded-2xl overflow-hidden cursor-pointer aspect-square"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.altText || ""}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  {item.folder && (
                    <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 z-10">
                      <FolderOpen size={12} />
                      {item.folder}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    {item.altText && (
                      <p className="text-white text-sm font-medium">
                        {item.altText}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AnimatedSection>
      )}

      {sectionVisibility.partners !== false && partners.length > 0 && (
        <section style={{ order: orderFor("partners", 6) }} className="mx-5 md:mx-auto my-20 w-[calc(100%-2.5rem)] max-w-[1280px] overflow-hidden">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">{partnersContent.title}</h2>
            <p className="text-outline max-w-lg mx-auto">{partnersContent.description}</p>
          </div>
          <div className="relative overflow-hidden">
            <div className="flex items-center gap-10 md:gap-16 marquee-right" style={{ animationDuration: "30s" }}>
              {[...partners, ...partners, ...partners].map((partner, idx) => (
                <div key={`${partner.id}-${idx}`} className="group shrink-0">
                  <img
                    src={partner.logoUrl}
                    alt={partner.name}
                    className="h-16 md:h-20 w-auto grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                    title={partner.name}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {sectionVisibility.cta !== false && (
      <AnimatedSection order={orderFor("cta", 7)} className="mx-5 md:mx-auto my-16 w-[calc(100%-2.5rem)] max-w-[1280px]">
        <div
          id="about"
          className="relative rounded-3xl overflow-hidden py-16 px-8 text-center border border-secondary/20"
          style={{
            background:
              "radial-gradient(circle at center, transparent 0%, rgba(3, 0, 75, 0.03) 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0L55 45L100 50L55 55L50 100L45 55L0 50L45 45Z' fill='%237b5814'/%3E%3C/svg%3E\")",
              backgroundSize: "80px 80px",
            }}
          />

          <div className="relative z-10 max-w-xl mx-auto">
            <h2 className="font-playfair text-3xl md:text-4xl text-primary mb-4">
              {ctaContent.title}
            </h2>
            <p className="text-outline leading-relaxed mb-8">
              {ctaContent.description}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setEmail("");
              }}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={String(ctaContent.placeholder)}
                className="flex-1 bg-white border border-outline-variant rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
              />
              <button
                type="submit"
                className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold hover:bg-primary-container transition-all active:scale-95"
              >
                {ctaContent.buttonText}
              </button>
            </form>
          </div>
        </div>
      </AnimatedSection>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 left-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors z-10"
          >
            <X size={24} />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
