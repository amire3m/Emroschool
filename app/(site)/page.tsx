"use client";

import { useState, useEffect, useRef, ReactNode, useCallback } from "react";
import Link from "next/link";
import { HomeSectionContent, parseHomeSectionContent } from "@/lib/home-sections";
import CategoryIcon from "@/components/CategoryIcon";
import AutoScrollSlider from "@/components/ui/autoscroll-slider";
import GlowingEdgeCard from "@/components/ui/glowing-edge-card";
import AutoLoopRow from "@/components/ui/auto-loop-row";
import { GlowEffect } from "@/components/ui/glow-effect";
import { getCookie } from "@/lib/cookie";
import NewsletterCta from "@/components/home/newsletter-cta";
import {
  Star,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
  X,
  AlertCircle,
} from "lucide-react";

interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

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
  title?: string | null;
  description?: string | null;
  slug?: string | null;
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
  const [categories, setCategories] = useState<HomeCategory[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = getCookie("token");
    if (!token) return;
    fetch("/api/auth/me", { headers: { authorization: `Bearer ${token}` } })
      .then((response) => setIsLoggedIn(response.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((response) => response.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

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
  const featured = courses.filter((c) => c.featured).slice(0, courseLimit);
  const displayCourses = featured.length > 0 ? featured : courses.slice(0, courseLimit);
  const displayInstructors = instructorLimit > 0 ? homeInstructors.slice(0, instructorLimit) : homeInstructors;

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

          <AutoLoopRow slideClassName="basis-[46%] sm:basis-[28%] lg:basis-[16%]" speed={0.75}>
              {categories.map((category) => {
                return (
                  <Link
                    key={category.id}
                    href={`/courses?category=${encodeURIComponent(category.name)}`}
                    title={category.description || category.name}
                    className="group relative isolate block h-full rounded-3xl p-[2px] text-center transition-all duration-500 hover:-translate-y-1"
                  >
                    <GlowEffect colors={["#03004b", "#7b5814", "#ffdeab", "#7b5814", "#03004b"]} mode="rotate" blur="softest" duration={5.5} scale={1.035} className="z-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-60" />
                    <div className="relative z-10 flex h-full min-h-40 flex-col rounded-[22px] border border-outline-variant/60 bg-white p-5 shadow-sm transition-all duration-500 group-hover:border-transparent group-hover:shadow-xl">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed/40 text-secondary transition-all group-hover:rotate-3 group-hover:bg-secondary-fixed">
                        <CategoryIcon name={category.icon} className="group-hover:scale-110 transition-transform" />
                      </div>
                      <h3 className="font-bold text-base text-primary">{category.name}</h3>
                      {category.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-outline">{category.description}</p>}
                    </div>
                  </Link>
                );
              })}
          </AutoLoopRow>
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
                <GlowingEdgeCard key={course.id} className="h-full">
                <Link
                  href={`/courses/${course.slug}`}
                  className="group block h-full bg-white overflow-hidden"
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

                    <div className="flex justify-end items-center border-t border-outline-variant/20 pt-3">
                      <div className="bg-primary/5 hover:bg-primary/10 p-2 rounded-full transition-colors">
                        <span className="text-primary text-sm font-bold">
                          مشاهده
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
                </GlowingEdgeCard>
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
            <AutoLoopRow slideClassName="basis-[68%] sm:basis-[38%] lg:basis-[24%]" speed={0.65} controlsAlwaysVisible>
                {displayInstructors.map((instructor) => {
                  const instName = instructor.name || instructor.user?.name || "";
                  const instAvatar = instructor.avatar || instructor.user?.avatar || null;
                  return (
                  <Link key={instructor.id} href={instructor.user?.id ? `/profile/${instructor.user.id}` : "/instructors"} className="group relative block h-full overflow-hidden rounded-3xl border border-outline-variant/50 bg-white p-4 text-center shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-secondary/50 hover:shadow-2xl before:absolute before:-inset-20 before:bg-[conic-gradient(from_90deg,transparent,#ffdeab55,transparent_35%)] before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100">
                    <div
                      className="relative mx-auto mb-5 aspect-[4/5] w-full overflow-hidden rounded-2xl"
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
                    <h4 className="font-bold text-lg text-primary mb-1 line-clamp-1">{instName}</h4>
                    <p className="text-secondary text-sm">{instructor.expertise || "مدرس آکادمی"}</p>
                  </Link>
                )})}
            </AutoLoopRow>
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
            <AutoScrollSlider
              items={galleryItems}
              onSelect={(item) => item.slug ? window.location.assign(`/gallery/${item.slug}`) : setLightbox(item.imageUrl)}
            />
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
           <AutoLoopRow slideClassName="basis-[42%] sm:basis-[25%] lg:basis-[16%]" speed={0.55} showControls={false}>
              {partners.map((partner) => (
                <div key={partner.id} className="group flex h-28 items-center justify-center rounded-2xl border border-outline-variant/40 bg-white p-5 shadow-sm transition hover:border-secondary/40 hover:shadow-md">
                  <img
                    src={partner.logoUrl}
                    alt={partner.name}
                    className="max-h-16 w-auto max-w-full grayscale opacity-55 transition-all duration-300 group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100"
                    title={partner.name}
                  />
                </div>
              ))}
          </AutoLoopRow>
        </section>
      )}

      {sectionVisibility.cta !== false && <NewsletterCta title={String(ctaContent.title)} description={String(ctaContent.description)} isLoggedIn={isLoggedIn} />}

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
