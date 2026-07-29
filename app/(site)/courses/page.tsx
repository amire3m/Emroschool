"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Star, Loader2 } from "lucide-react";

interface Course {
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
  rating: number;
  ratingCount: number;
  duration?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  courseCount: number;
}

function formatPrice(price: number) {
  return price.toLocaleString("fa-IR");
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("همه");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [coursesRes, categoriesRes] = await Promise.all([
          fetch("/api/courses"),
          fetch("/api/categories"),
        ]);
        const coursesData = await coursesRes.json();
        setCourses(coursesData.courses || []);
        if (categoriesRes.ok) {
          const catsData = await categoriesRes.json();
          setCategories(catsData.categories || []);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = courses.filter((course) => {
    const matchCategory =
      activeCategory === "همه" || course.category === activeCategory;
    const matchSearch =
      !searchQuery ||
      course.title.includes(searchQuery) ||
      course.instructor?.includes(searchQuery);
    return matchCategory && matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center pt-24">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary">همه دوره‌ها</h1>
          <p className="text-outline mt-1">
            دوره‌های تخصصی هنر و رسانه را مرور کنید
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی دوره..."
              className="w-full bg-white border border-outline-variant rounded-xl pr-10 pl-4 py-3 text-sm focus:ring-2 focus:ring-secondary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory("همه")}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              activeCategory === "همه"
                ? "bg-primary text-white"
                : "bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary"
            }`}
          >
            همه
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                activeCategory === cat.name
                  ? "bg-primary text-white"
                  : "bg-white border border-outline-variant text-outline hover:border-primary hover:text-primary"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-outline text-lg">دوره‌ای یافت نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-outline-variant/30"
              >
                <div className="relative aspect-video overflow-hidden">
                  {course.thumbnail ? (
                    <div
                      className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
                      style={{ backgroundImage: `url(${course.thumbnail})` }}
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-variant flex items-center justify-center">
                      <span className="text-outline-variant text-lg">
                        تصویر ندارد
                      </span>
                    </div>
                  )}
                  {course.category && (
                    <div className="absolute top-3 right-3 bg-secondary-fixed text-on-secondary-fixed text-xs font-bold px-2 py-1 rounded">
                      {course.category}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {course.instructor && (
                    <p className="text-outline text-xs mb-1">
                      {course.instructor}
                    </p>
                  )}
                  <h4 className="font-bold text-primary text-base mb-2 line-clamp-2 leading-relaxed">
                    {course.title}
                  </h4>
                  <div className="flex items-center gap-1 text-secondary mb-3">
                    <Star
                      size={14}
                      className="fill-current"
                    />
                    <span className="font-bold text-sm">{course.rating}</span>
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
                      <div className="text-primary font-black text-lg">
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
    </div>
  );
}
