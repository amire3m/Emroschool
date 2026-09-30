"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
   X,
   Check,
   Link2,
   Layers3,
   GitBranch,
   ChevronDown,
   Folder,
    FolderOpen,
    User,
    LockKeyhole,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import Link from "next/link";
import ImageUpload from "@/components/ui/ImageUpload";
import PersianDateTimePicker from "@/components/ui/persian-date-time-picker";
import CourseCurriculumEditor, { canReplaceCourseContext, ContextReplacementGroup, createDetailRequestOwner } from "@/components/admin/course-curriculum-editor";
import type { CurriculumInput } from "@/lib/course-curriculum";
import {
  PageHeader,
  Badge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  SearchInput,
  Modal,
} from "@/components/admin/ui";

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  oldPrice: number | null;
  instructor: string | null;
  instructorId: string | null;
  instructorProfile?: { id: string; profileSlug?: string | null; name: string | null; avatar?: string | null; user?: { id: string; name: string; avatar?: string | null } | null } | null;
  instructors?: Array<{ instructor: { id: string; name: string | null; avatar?: string | null; user?: { id: string; name: string; avatar?: string | null } | null } }>;
  categoryName: string | null;
  categoryId: string | null;
  level: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  published: boolean;
  featured: boolean;
  createdAt: string;
  courseType: "comprehensive" | "single";
  scheduleStatus: "upcoming" | "completed";
  startDate: string | null;
  endDate: string | null;
  deliveryModes?: string;
  parentId: string | null;
  parent?: { id: string; title: string } | null;
  prerequisiteId?: string | null;
  prerequisite?: { id: string; title: string; slug: string } | null;
  childCount?: number;
  enrollmentCount?: number;
  curriculum?: CurriculumInput;
}

const levels = ["مبتدی", "متوسط", "پیشرفته"];

const levelMap: Record<string, string> = {
  مبتدی: "beginner",
  متوسط: "intermediate",
  پیشرفته: "advanced",
};

const reverseLevelMap: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};

function toSlug(str: string) {
  const map: Record<string, string> = {
    ا: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h",
    خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh",
    ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh",
    ک: "k", گ: "g", ل: "l", م: "m", ن: "n", و: "v", ه: "h", ی: "y",
    " ": "-",
  };
  let slug = "";
  for (const ch of str) {
    slug += map[ch] || ch;
  }
  return slug
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const priceUnits = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const priceTeens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const priceTens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const priceHundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const priceScales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function normalizePrice(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "");
}

function formatPrice(value: string) {
  const digits = normalizePrice(value);
  return digits ? Number(digits).toLocaleString("fa-IR") : "";
}

function threeDigitPriceToWords(value: number) {
  const words: string[] = [];
  if (value >= 100) words.push(priceHundreds[Math.floor(value / 100)]);
  const remainder = value % 100;
  if (remainder >= 20) {
    words.push(priceTens[Math.floor(remainder / 10)]);
    if (remainder % 10) words.push(priceUnits[remainder % 10]);
  } else if (remainder >= 10) words.push(priceTeens[remainder - 10]);
  else if (remainder > 0) words.push(priceUnits[remainder]);
  return words.join(" و ");
}

function priceInWords(value: string) {
  const amount = Number(normalizePrice(value));
  if (!amount) return "صفر تومان";
  const groups: string[] = [];
  let remaining = amount;
  let scaleIndex = 0;
  while (remaining && scaleIndex < priceScales.length) {
    const group = remaining % 1000;
    if (group) groups.unshift([threeDigitPriceToWords(group), priceScales[scaleIndex]].filter(Boolean).join(" "));
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }
  return `${groups.join(" و ")} تومان`;
}

function PriceField({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  const hasValue = Boolean(normalizePrice(value));
  return <div>
    <label className="mb-1 block text-sm font-medium text-slate-900">{label}</label>
    <div className="relative">
      <input type="text" inputMode="numeric" value={formatPrice(value)} onChange={(event) => onChange(normalizePrice(event.target.value))} placeholder="۰" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pl-16 text-sm font-bold tabular-nums text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15" />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">تومان</span>
    </div>
    <p className={`mt-1.5 min-h-5 text-xs leading-5 ${hasValue ? "text-slate-600" : "text-slate-400"}`}>{optional && !hasValue ? "در صورت تخفیف وارد کنید" : priceInWords(value)}</p>
  </div>;
}

function InstructorAvatar({ name, avatar }: { name?: string | null; avatar?: string | null }) {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
    {avatar ? <img src={avatar} alt={name || ""} className="h-full w-full object-cover" /> : <User size={14} />}
  </span>;
}

const INPUT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15";
const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string | null; avatar?: string | null; user?: { id: string; name: string; avatar?: string | null } | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCourseId, setLoadingCourseId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [existingChildId, setExistingChildId] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [instructorSearch, setInstructorSearch] = useState("");
  const [showInstructorMenu, setShowInstructorMenu] = useState(false);
  const [instructorsChanged, setInstructorsChanged] = useState(false);
  const [studentCourse, setStudentCourse] = useState<{ title: string; students: Array<{ id: string; createdAt: string; user: { id: string; name: string; email: string; phone?: string | null; avatar?: string | null } }> } | null>(null);
  const [detailRequestOwner] = useState(createDetailRequestOwner);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: "",
    oldPrice: "",
    instructor: "",
    instructorIds: [] as string[],
    category: "",
    level: "",
    thumbnail: "",
    videoUrl: "",
    published: false,
    featured: false,
    courseType: "single",
    scheduleStatus: "upcoming",
    startDate: "",
    endDate: "",
    deliveryModes: ["in_person"] as string[],
    parentId: "",
    prerequisiteId: "",
    curriculum: [] as CurriculumInput,
  });

  const getToken = () => getCookie("token") || "";
  const copyCourseLink = async (slug: string) => { await navigator.clipboard.writeText(`${window.location.origin}/courses/${slug}`); toast.success("لینک دوره کپی شد"); };
  const showStudents = async (course: Course) => { try { const response = await fetch(`/api/courses/${course.id}`, { headers: { authorization: `Bearer ${getToken()}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStudentCourse({ title: course.title, students: data.course.enrollments || [] }); } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در دریافت دانشجویان"); } };

  const fetchCourses = () => {
    const token = getToken();
    Promise.all([
      fetch("/api/courses", { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch("/api/categories").then((response) => response.json()),
      fetch("/api/instructors", { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()),
    ])
      .then(([courseData, categoryData, instructorData]) => {
        if (courseData.courses) setCourses(courseData.courses);
        setCategories(categoryData.categories || []);
        setInstructors(instructorData.instructors || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCourses();
    return () => detailRequestOwner.cancel();
  }, []);

  const resetForm = () => {
    setForm({
      title: "",
      slug: "",
      description: "",
      price: "",
      oldPrice: "",
      instructor: "",
      instructorIds: [],
      category: "",
      level: "",
      thumbnail: "",
      videoUrl: "",
      published: false,
      featured: false,
      courseType: "single",
      scheduleStatus: "upcoming",
      startDate: "",
      endDate: "",
      deliveryModes: ["in_person"],
      parentId: "",
      prerequisiteId: "",
      curriculum: [],
    });
    setEditingCourse(null);
    setInstructorsChanged(false);
    setSaveError("");
  };

  const openCreateModal = () => {
    if (!canReplaceCourseContext(saving)) return;
    detailRequestOwner.cancel();
    setLoadingCourseId("");
    resetForm();
    setShowModal(true);
  };

  const openCreateChildCourse = (parent: Course) => {
    if (!canReplaceCourseContext(saving)) return;
    detailRequestOwner.cancel();
    setLoadingCourseId("");
    setEditingCourse(null);
    setForm({
      title: "", slug: "", description: "", price: "", oldPrice: "", instructor: "", instructorIds: [], category: parent.categoryId || "", level: "", thumbnail: "", videoUrl: "", published: false, featured: false,
      courseType: "single", scheduleStatus: "upcoming", startDate: "", endDate: "", deliveryModes: ["in_person"], parentId: parent.id, prerequisiteId: "", curriculum: [],
    });
    setSaveError("");
    setShowModal(true);
  };

  const attachExistingCourse = async (parent: Course) => {
    if (!existingChildId) return;
    detailRequestOwner.cancel();
    setLoadingCourseId("");
    setSaving(true);
    try {
      const response = await fetch(`/api/courses/${existingChildId}`, { method: "PUT", headers: { "Content-Type": "application/json", authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ parentId: parent.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "اتصال دوره انجام نشد");
      toast.success("دوره به زیر‌دوره‌های این مجموعه اضافه شد");
      setExistingChildId("");
      fetchCourses();
    } catch (attachError) { toast.error(attachError instanceof Error ? attachError.message : "اتصال دوره انجام نشد"); }
    finally { setSaving(false); }
  };

  const openEditModal = async (course: Course) => {
    if (!canReplaceCourseContext(saving)) return;
    const request = detailRequestOwner.begin();
    setLoadingCourseId(course.id);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        headers: { authorization: `Bearer ${getToken()}` },
        signal: request.controller.signal,
      });
      const data = await response.json();
      if (!detailRequestOwner.isCurrent(request)) return;
      if (!response.ok || !data.course) {
        throw new Error(data.error || "خطا در دریافت جزئیات دوره");
      }
      const detail = data.course as Course;
      setForm({
        title: detail.title,
        slug: detail.slug,
        description: detail.description,
        price: formatPrice(String(detail.price)),
        oldPrice: detail.oldPrice ? formatPrice(String(detail.oldPrice)) : "",
        instructor: detail.instructor || "",
        instructorIds: detail.instructors?.map((assignment) => assignment.instructor.id) || (detail.instructorId ? [detail.instructorId] : []),
        category: detail.categoryId || categories.find((category) => category.name === detail.categoryName)?.id || "",
        level: reverseLevelMap[detail.level || ""] || detail.level || "",
        thumbnail: detail.thumbnail || "",
        videoUrl: detail.videoUrl || "",
        published: detail.published,
        featured: detail.featured,
        courseType: detail.courseType || "single",
        scheduleStatus: detail.scheduleStatus || "upcoming",
        startDate: detail.startDate || "",
        endDate: detail.endDate || "",
        deliveryModes: (detail.deliveryModes || "in_person").split(",").filter(Boolean),
        parentId: detail.parentId || "",
        prerequisiteId: detail.prerequisiteId || "",
        curriculum: (detail.curriculum || []).map((chapter) => ({
          ...(chapter.id ? { id: chapter.id } : {}),
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => ({
            ...(lesson.id ? { id: lesson.id } : {}),
            title: lesson.title,
            durationMinutes: lesson.durationMinutes ?? null,
          })),
        })),
      });
      setEditingCourse(detail);
      setInstructorsChanged(false);
      setSaveError("");
      setShowModal(true);
    } catch (editError) {
      if (!detailRequestOwner.isCurrent(request)) return;
      toast.error(editError instanceof Error ? editError.message : "خطا در دریافت جزئیات دوره");
    } finally {
      if (detailRequestOwner.finish(request)) setLoadingCourseId("");
    }
  };

  const closeCourseModal = () => {
    if (!canReplaceCourseContext(saving)) return;
    detailRequestOwner.cancel();
    setLoadingCourseId("");
    setShowModal(false);
  };

  const handleTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: editingCourse ? prev.slug : toSlug(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    detailRequestOwner.cancel();
    setLoadingCourseId("");
    setSaving(true);
    setSaveError("");
    const token = getToken();

    const selectedCategory = categories.find((category) => category.id === form.category);
    const body = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      price: Number(normalizePrice(form.price)) || 0,
      oldPrice: normalizePrice(form.oldPrice) ? Number(normalizePrice(form.oldPrice)) : null,
      ...(!editingCourse || instructorsChanged ? { instructor: form.instructor || null, instructorIds: form.instructorIds } : {}),
      categoryId: selectedCategory?.id || null,
      categoryName: selectedCategory?.name || null,
      level: levelMap[form.level] || form.level || null,
      thumbnail: form.thumbnail || null,
      videoUrl: form.videoUrl || null,
      published: form.published,
      featured: form.featured,
      courseType: form.courseType,
      scheduleStatus: form.scheduleStatus,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      deliveryModes: form.deliveryModes,
      parentId: form.courseType === "single" ? form.parentId || null : null,
      prerequisiteId: form.prerequisiteId || null,
      curriculum: form.curriculum,
    };

    try {
      if (editingCourse) {
        const res = await fetch(`/api/courses/${editingCourse.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در بروزرسانی");
        }
        toast.success("دوره با موفقیت بروزرسانی شد");
      } else {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "خطا در ایجاد دوره");
        }
        toast.success("دوره با موفقیت ایجاد شد");
      }
      setShowModal(false);
      resetForm();
      fetchCourses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "ذخیره دوره انجام نشد";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const token = getToken();

    try {
      const res = await fetch(`/api/courses/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطا در حذف");
      }
      toast.success("دوره با موفقیت حذف شد");
      setDeleteTarget(null);
      fetchCourses();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  const filtered = courses.filter(
    (c) =>
      c.title.includes(search) ||
      c.instructor?.includes(search) ||
      c.categoryName?.includes(search)
  );
  const comprehensiveCourses = courses.filter((course) => course.courseType === "comprehensive" && (!search || filtered.some((item) => item.id === course.id || item.parentId === course.id)));
  const standaloneCourses = filtered.filter((course) => course.courseType === "single" && !course.parentId);
  const childrenFor = (parentId: string) => courses.filter((course) => course.parentId === parentId && (!search || filtered.some((item) => item.id === course.id)));
  const toggleFolder = (id: string) => setExpandedFolders((folders) => folders.includes(id) ? folders.filter((folderId) => folderId !== id) : [...folders, id]);
  const selectedInstructors = instructors.filter((instructor) => form.instructorIds.includes(instructor.id));
  const matchingInstructors = instructors.filter((instructor) => {
    const name = instructor.name || instructor.user?.name || "";
    return name.includes(instructorSearch);
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-red-600">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="مدیریت دوره‌ها"
        actions={
          <PrimaryButton onClick={openCreateModal}>
            <Plus size={18} />
            افزودن دوره جدید
          </PrimaryButton>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <SearchInput
            type="text"
            placeholder="جستجوی دوره..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {comprehensiveCourses.map((course) => {
          const children = childrenFor(course.id);
          const isExpanded = expandedFolders.includes(course.id) || Boolean(search);
          return <section key={course.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4">
              <button type="button" onClick={() => toggleFolder(course.id)} className={`flex min-w-0 flex-1 items-center gap-3 text-right ${FOCUS_VISIBLE} rounded-lg`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{isExpanded ? <FolderOpen size={21} /> : <Folder size={21} />}</span>
                <span className="min-w-0"><span className="block truncate font-bold text-slate-900">{course.title}</span><span className="mt-1 block text-xs tabular-nums text-slate-500">{(course.childCount || 0).toLocaleString("fa-IR")} زیر‌دوره</span></span>
                <ChevronDown size={18} className={`mr-auto shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              <div className="flex items-center gap-1">
                <button type="button" disabled={saving} onClick={() => openCreateChildCourse(course)} className={`rounded-lg px-2.5 py-2 text-xs font-bold text-[#03004b] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_VISIBLE}`} title="افزودن زیر‌دوره"><Plus size={17} /></button>
                <button type="button" disabled={saving || Boolean(loadingCourseId)} onClick={() => openEditModal(course)} className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait disabled:opacity-50 ${FOCUS_VISIBLE}`} title="ویرایش پوشه" aria-label={`ویرایش ${course.title}`}>{loadingCourseId === course.id ? <Loader2 size={17} className="animate-spin" /> : <Pencil size={17} />}</button>
                <button type="button" onClick={() => setDeleteTarget(course)} className={`rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 ${FOCUS_VISIBLE}`} title="حذف"><Trash2 size={17} /></button>
              </div>
            </div>
            {isExpanded && <div className="divide-y divide-slate-100 border-t border-slate-100">
              {children.map((child) => <div key={child.id} className="flex flex-wrap items-center gap-3 px-4 py-3 pr-7 hover:bg-slate-50/60">
                <GitBranch size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{child.title}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><InstructorAvatar name={child.instructor} avatar={child.instructorProfile?.avatar || child.instructorProfile?.user?.avatar} />{child.instructorProfile ? <Link href={`/instructors/${child.instructorProfile.profileSlug || child.instructorProfile.id}`} target="_blank" className={`font-bold text-[#03004b] hover:underline ${FOCUS_VISIBLE} rounded`}>{child.instructor || "بدون مدرس"}</Link> : <span>{child.instructor || "بدون مدرس"}</span>}<span className="tabular-nums">· {child.price.toLocaleString("fa-IR")} تومان</span></p></div>
                <Badge tone={child.published ? "emerald" : "slate"}>{child.published ? "منتشر شده" : "پیش‌نویس"}</Badge>
                <div className="flex items-center gap-1"><button type="button" onClick={() => showStudents(child)} className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="دانشجویان دوره"><User size={15} /></button><button type="button" onClick={() => copyCourseLink(child.slug)} className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="کپی لینک"><Link2 size={15} /></button><button type="button" disabled={saving || Boolean(loadingCourseId)} onClick={() => openEditModal(child)} className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait disabled:opacity-50 ${FOCUS_VISIBLE}`} title="ویرایش" aria-label={`ویرایش ${child.title}`}>{loadingCourseId === child.id ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}</button><button type="button" onClick={() => setDeleteTarget(child)} className={`rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 ${FOCUS_VISIBLE}`} title="حذف"><Trash2 size={15} /></button></div>
              </div>)}
              {children.length === 0 && <p className="p-4 text-center text-sm text-slate-500">زیر‌دوره‌ای در این پوشه نیست.</p>}
            </div>}
          </section>;
        })}

        {standaloneCourses.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">دوره‌های مستقل</div><div className="divide-y divide-slate-100">{standaloneCourses.map((course) => <div key={course.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50/60"><GitBranch size={17} className="shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{course.title}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><InstructorAvatar name={course.instructor} avatar={course.instructorProfile?.avatar || course.instructorProfile?.user?.avatar} />{course.instructor || "بدون مدرس"}<span className="tabular-nums">· {course.price.toLocaleString("fa-IR")} تومان</span></p></div><Badge tone={course.published ? "emerald" : "slate"}>{course.published ? "منتشر شده" : "پیش‌نویس"}</Badge><div className="flex items-center gap-1"><button type="button" onClick={() => copyCourseLink(course.slug)} className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${FOCUS_VISIBLE}`} title="کپی لینک"><Link2 size={15} /></button><button type="button" disabled={saving || Boolean(loadingCourseId)} onClick={() => openEditModal(course)} className={`rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait disabled:opacity-50 ${FOCUS_VISIBLE}`} title="ویرایش" aria-label={`ویرایش ${course.title}`}>{loadingCourseId === course.id ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}</button><button type="button" onClick={() => setDeleteTarget(course)} className={`rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 ${FOCUS_VISIBLE}`} title="حذف"><Trash2 size={15} /></button></div></div>)}</div></section>}

        {comprehensiveCourses.length === 0 && standaloneCourses.length === 0 && <div className="rounded-xl border border-slate-200 bg-white"><EmptyState message="هیچ دوره‌ای یافت نشد" /></div>}
      </div>

      {studentCourse && <Modal title={studentCourse.title} subtitle="دانشجویان دوره" onClose={() => setStudentCourse(null)} maxWidth="max-w-2xl"><div className="grid gap-3 sm:grid-cols-2">{studentCourse.students.map((student) => <div key={student.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><InstructorAvatar name={student.user.name} avatar={student.user.avatar} /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{student.user.name}</p><p className="truncate text-xs text-slate-500">{student.user.phone || student.user.email}</p><p className="mt-1 text-[10px] tabular-nums text-slate-500">ثبت‌نام {new Date(student.createdAt).toLocaleDateString("fa-IR")}</p></div></div>)}{studentCourse.students.length === 0 && <p className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">هنوز دانشجویی در این دوره ثبت‌نام نکرده است.</p>}</div></Modal>}

      {showModal && (
        <Modal
          title={editingCourse ? "ویرایش دوره" : "افزودن دوره جدید"}
          onClose={closeCourseModal}
          maxWidth="max-w-5xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
              {saveError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600"><AlertCircle size={18} className="mt-0.5 shrink-0" />{saveError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">عنوان</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className={`w-full ${INPUT_CLASS}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">آدرس در سایت</label>
                   <div className="space-y-1.5" dir="ltr">
                     <div className="w-full select-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">imamruhollahschool.com/courses/</div>
                     <input
                      type="text"
                      required
                      value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                       className={`w-full ${INPUT_CLASS}`}
                      style={{ fontFamily: "'Courier New', monospace" }}
                    />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><LockKeyhole size={13} aria-hidden="true" />به‌صورت خودکار از عنوان ساخته می‌شود</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">توضیحات</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className={`w-full resize-none ${INPUT_CLASS}`}
                />
              </div>

              <CourseCurriculumEditor
                key={editingCourse?.id || `new-${form.parentId}`}
                value={form.curriculum}
                onChange={(curriculum) => setForm((current) => ({ ...current, curriculum }))}
                disabled={saving}
              />

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">ساختار و زمان‌بندی دوره</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="sm:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-900">ساختار این محتوا</label><div className="grid sm:grid-cols-2 gap-3"><button type="button" onClick={() => setForm((p) => ({ ...p, courseType: "comprehensive", parentId: "" }))} className={`text-right rounded-xl border p-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${form.courseType === "comprehensive" ? "border-[#03004b] bg-[#03004b] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#03004b]/40"}`}><Layers3 size={22} className={form.courseType === "comprehensive" ? "text-white" : "text-slate-400"} /><p className="mt-3 font-black">مجموعه جامع</p><p className={`mt-1 text-xs leading-6 ${form.courseType === "comprehensive" ? "text-white/70" : "text-slate-500"}`}>فقط معرفی، زمان‌بندی و دسته‌بندی زیر‌دوره‌ها. خرید و ثبت‌نام ندارد.</p></button><button type="button" onClick={() => setForm((p) => ({ ...p, courseType: "single" }))} className={`text-right rounded-xl border p-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${form.courseType === "single" ? "border-[#03004b] bg-[#03004b] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#03004b]/40"}`}><GitBranch size={22} className={form.courseType === "single" ? "text-white" : "text-slate-400"} /><p className="mt-3 font-black">دوره مستقل یا زیر‌دوره</p><p className={`mt-1 text-xs leading-6 ${form.courseType === "single" ? "text-white/70" : "text-slate-500"}`}>دارای صفحه اقدام مستقل؛ می‌تواند به یک مجموعه جامع متصل شود.</p></button></div></div>
                    {form.courseType === "comprehensive" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-700 sm:col-span-2">این مجموعه بعد از ساخت زیر‌دوره‌ها قابل انتشار است. کاربران فقط در صفحه زیر‌دوره‌ها خرید یا فرم ثبت‌نام را می‌بینند.</div>}
                   <ContextReplacementGroup saving={saving}>
                   {form.courseType === "comprehensive" && editingCourse && <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h5 className="text-sm font-black text-slate-900">زیر‌دوره‌های این مجموعه</h5><p className="mt-1 text-xs text-slate-500">هر زیر‌دوره فرم ثبت‌نام و پرداخت مستقل دارد.</p></div><PrimaryButton onClick={() => openCreateChildCourse(editingCourse)} className="px-4 py-2 text-sm"><Plus size={16} />افزودن زیر‌دوره جدید</PrimaryButton></div><div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">افزودن از دوره‌های قبلی</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><select value={existingChildId} onChange={(event) => setExistingChildId(event.target.value)} className={`min-w-0 flex-1 ${INPUT_CLASS} ${FOCUS_VISIBLE}`}><option value="">یک دوره مستقل را انتخاب کنید</option>{courses.filter((item) => item.courseType === "single" && !item.parentId && item.id !== editingCourse.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><SecondaryButton disabled={!existingChildId || saving} onClick={() => attachExistingCourse(editingCourse)} className="px-4 py-2.5 text-sm">افزودن به مجموعه</SecondaryButton></div></div><div className="mt-4 space-y-2">{courses.filter((item) => item.parentId === editingCourse.id).length ? courses.filter((item) => item.parentId === editingCourse.id).map((child) => <button type="button" key={child.id} onClick={() => openEditModal(child)} className={`flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-right hover:bg-slate-100 ${FOCUS_VISIBLE}`}><span className="text-sm font-bold text-slate-900">{child.title}</span><span className="text-xs text-slate-500">ویرایش زیر‌دوره</span></button>) : <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">هنوز زیر‌دوره‌ای برای این مجموعه ثبت نشده است.</p>}</div></div>}
                   </ContextReplacementGroup>
                   {form.courseType === "single" && <div><label className="mb-1 block text-sm font-medium text-slate-900">دوره جامع والد (اختیاری)</label><select value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))} className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}><option value="">دوره مستقل؛ بدون والد</option>{courses.filter((item) => item.courseType === "comprehensive" && item.id !== editingCourse?.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}
                  <div><label className="mb-1 block text-sm font-medium text-slate-900">پیش‌نیاز دوره (اختیاری)</label><select value={form.prerequisiteId} onChange={(e) => setForm((p) => ({ ...p, prerequisiteId: e.target.value }))} className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}><option value="">این دوره پیش‌نیاز ندارد</option>{courses.filter((item) => item.courseType === "single" && item.id !== editingCourse?.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
                  <div><label className="mb-1 block text-sm font-medium text-slate-900">وضعیت برگزاری</label><select value={form.scheduleStatus} onChange={(e) => setForm((p) => ({ ...p, scheduleStatus: e.target.value }))} className={`w-full ${INPUT_CLASS} ${FOCUS_VISIBLE}`}><option value="upcoming">قرار است برگزار شود</option><option value="completed">برگزار شده و پایان یافته</option></select></div>
                  <div><label className="mb-1 block text-sm font-medium text-slate-900">{form.scheduleStatus === "upcoming" ? "تاریخ شروع (شمسی)" : "تاریخ پایان (شمسی)"}</label><PersianDateTimePicker required value={form.scheduleStatus === "upcoming" ? form.startDate : form.endDate} onChange={(value) => setForm((p) => form.scheduleStatus === "upcoming" ? { ...p, startDate: value } : { ...p, endDate: value })} /></div>
                   <div className="sm:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-900">شیوه برگزاری</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm((p) => ({ ...p, deliveryModes: p.deliveryModes.includes("in_person") ? p.deliveryModes.filter((mode) => mode !== "in_person") : [...p.deliveryModes, "in_person"] }))} className={`rounded-xl border p-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${form.deliveryModes.includes("in_person") ? "border-[#03004b] bg-[#03004b] text-white" : "border-slate-200 bg-white text-slate-500"}`}>حضوری</button><button type="button" onClick={() => setForm((p) => ({ ...p, deliveryModes: p.deliveryModes.includes("virtual") ? p.deliveryModes.filter((mode) => mode !== "virtual") : [...p.deliveryModes, "virtual"] }))} className={`rounded-xl border p-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${form.deliveryModes.includes("virtual") ? "border-[#03004b] bg-[#03004b] text-white" : "border-slate-200 bg-white text-slate-500"}`}>مجازی</button></div><p className="mt-2 text-xs text-slate-500">می‌توانید یک یا هر دو شیوه را انتخاب کنید.</p></div>
                </div>
              </div>

               {form.courseType === "single" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PriceField label="قیمت دوره" value={form.price} onChange={(price) => setForm((p) => ({ ...p, price }))} />
                  <PriceField label="قیمت پیش از تخفیف" value={form.oldPrice} onChange={(oldPrice) => setForm((p) => ({ ...p, oldPrice }))} optional />
               </div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">مدرس</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={instructorSearch}
                      onFocus={() => setShowInstructorMenu(true)}
                      onChange={(event) => { setInstructorSearch(event.target.value); setShowInstructorMenu(true); }}
                    placeholder={selectedInstructors.length ? "افزودن یا جستجوی مدرس دیگر..." : "جستجوی نام مدرس..."}
                      className={`w-full ${INPUT_CLASS}`}
                    />
                    {showInstructorMenu && <div className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      {matchingInstructors.map((instructor) => {
                        const name = instructor.name || instructor.user?.name || "بدون نام";
                        const selected = form.instructorIds.includes(instructor.id);
                        return <button type="button" key={instructor.id} onClick={() => { setForm((form) => ({ ...form, instructorIds: selected ? form.instructorIds.filter((id) => id !== instructor.id) : [...form.instructorIds, instructor.id] })); setInstructorsChanged(true); setInstructorSearch(""); setShowInstructorMenu(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-right text-sm transition hover:bg-slate-50 ${selected ? "bg-slate-100 text-slate-900" : "text-slate-700"}`}><InstructorAvatar name={name} avatar={instructor.avatar || instructor.user?.avatar} /><span className="min-w-0 flex-1 truncate font-medium">{name}</span>{selected && <Check size={16} className="text-[#03004b]" />}</button>;
                      })}
                      {matchingInstructors.length === 0 && <p className="p-3 text-center text-xs text-slate-500">مدرسی پیدا نشد</p>}
                    </div>}
                  </div>
                   {selectedInstructors.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{selectedInstructors.map((instructor) => { const name = instructor.name || instructor.user?.name || "بدون نام"; return <span key={instructor.id} className="flex items-center gap-2 rounded-xl bg-slate-100 px-2 py-1.5 text-sm text-slate-700"><InstructorAvatar name={name} avatar={instructor.avatar || instructor.user?.avatar} /><span>{name}</span><button type="button" onClick={() => { setForm((form) => ({ ...form, instructorIds: form.instructorIds.filter((id) => id !== instructor.id) })); setInstructorsChanged(true); }} className={`rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600 ${FOCUS_VISIBLE}`} title={`حذف ${name}`}><X size={14} /></button></span>; })}</div>}
                  <Link href="/admin/users?create=instructor" className={`mt-2 inline-block rounded text-xs font-bold text-[#03004b] hover:underline ${FOCUS_VISIBLE}`}>استاد جدید است؟ ابتدا کاربر مدرس ایجاد کنید</Link>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">دسته‌بندی</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className={`w-full ${INPUT_CLASS}`}
                  >
                    <option value="">انتخاب کنید</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">سطح</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                    className={`w-full ${INPUT_CLASS}`}
                  >
                    <option value="">انتخاب کنید</option>
                    {levels.map((lv) => (
                      <option key={lv} value={lv}>{lv}</option>
                    ))}
                  </select>
                </div>
                <ImageUpload
                  value={form.thumbnail}
                  onChange={(url) => setForm((p) => ({ ...p, thumbnail: url }))}
                  label="تصویر شاخص دوره"
                  sizeHint="۹۰۰ × ۱۶۰۰ پیکسل"
                  aspectRatio="9:16"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">آدرس ویدئو</label>
                <input
                  type="text"
                  value={form.videoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
                  className={`w-full ${INPUT_CLASS}`}
                  dir="ltr"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[#03004b]"
                  />
                  <span className="text-sm text-slate-900">منتشر شده</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[#03004b]"
                  />
                   <span className="text-sm text-slate-900">نمایش در دوره‌های منتخب صفحه اصلی</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <PrimaryButton type="submit" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingCourse ? "بروزرسانی" : "ایجاد دوره"}
                </PrimaryButton>
                <SecondaryButton
                  onClick={closeCourseModal}
                  disabled={saving}
                >
                  انصراف
                </SecondaryButton>
              </div>
            </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="حذف دوره"
          onClose={() => { if (!saving) setDeleteTarget(null); }}
          maxWidth="max-w-md"
          footer={
            <>
              <DangerButton onClick={handleDelete} disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                حذف
              </DangerButton>
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>
                انصراف
              </SecondaryButton>
            </>
          }
        >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <p className="mb-1 text-sm text-slate-500">
                آیا از حذف دوره <span className="font-bold text-slate-900">"{deleteTarget.title}"</span> اطمینان دارید؟
              </p>
              <p className="text-xs text-slate-500">این عمل قابل بازگشت نیست.</p>
            </div>
        </Modal>
      )}
    </div>
  );
}
