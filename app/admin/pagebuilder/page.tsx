"use client";

import { useEffect, useState } from "react";
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  Layout,
  BookOpen,
  Users,
  Camera,
  Megaphone,
  Sliders,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

interface SectionMeta {
  id: string;
  slug: string;
  label: string;
  icon: string;
  order: number;
  visible: boolean;
  content?: string;
}

const defaultSections: SectionMeta[] = [
  { id: "", slug: "hero", label: "اسلایدر و هیرو", icon: "Sliders", order: 1, visible: true },
  { id: "", slug: "departments", label: "دپارتمان‌های تخصصی", icon: "Layout", order: 2, visible: true },
  { id: "", slug: "courses", label: "دوره‌های منتخب", icon: "BookOpen", order: 3, visible: true },
  { id: "", slug: "instructors", label: "اساتید مدرسه", icon: "Users", order: 4, visible: true },
  { id: "", slug: "gallery", label: "گالری تصاویر", icon: "Camera", order: 5, visible: true },
  { id: "", slug: "partners", label: "همراهان", icon: "Users", order: 6, visible: true },
  { id: "", slug: "cta", label: "دعوت به اقدام (CTA)", icon: "Megaphone", order: 7, visible: true },
];

const iconMap: Record<string, React.ReactNode> = {
  Sliders: <Sliders size={18} />,
  Layout: <Layout size={18} />,
  BookOpen: <BookOpen size={18} />,
  Users: <Users size={18} />,
  Camera: <Camera size={18} />,
  Megaphone: <Megaphone size={18} />,
};

export default function AdminPageBuilder() {
  const [sections, setSections] = useState<SectionMeta[]>(defaultSections);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const getToken = () => getCookie("token") || "";

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch("/api/page-builder", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const serverSections: SectionMeta[] = data.sections || [];
        if (serverSections.length > 0) {
          const merged = defaultSections.map((def) => {
            const match = serverSections.find((s) => s.slug === def.slug);
            return match ? { ...def, id: match.id, order: match.order, visible: match.visible, content: match.content } : def;
          });
          setSections(merged.sort((a, b) => a.order - b.order));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const updateOrder = (slug: string, direction: "up" | "down") => {
    const idx = sections.findIndex((s) => s.slug === slug);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sections.length - 1) return;

    const newSections = [...sections];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    setSections(newSections.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const toggleVisibility = (slug: string) => {
    setSections((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, visible: !s.visible } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();

    try {
      const promises = sections.map((sec) =>
        fetch("/api/page-builder", {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            slug: sec.slug,
            content: sec.content || "",
            order: sec.order,
            visible: sec.visible,
          }),
        }).then((r) => {
          if (!r.ok) throw new Error(`خطا در ذخیره ${sec.label}`);
        })
      );
      await Promise.all(promises);
      toast.success("تمامی بخش‌ها با موفقیت ذخیره شدند");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-error gap-2">
        <AlertCircle size={20} />
        <span>خطا: {error}</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-primary">ویرایش صفحه اصلی</h3>
            <p className="text-sm text-outline mt-0.5">
              نمایش/عدم نمایش و ترتیب بخش‌های صفحه اصلی را مدیریت کنید
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            ذخیره تغییرات
          </button>
        </div>

        <div className="space-y-3">
          {sections.map((sec, index) => (
            <div
              key={sec.slug}
              className={`border border-surface-variant rounded-2xl p-4 transition-all ${
                sec.visible ? "bg-white" : "bg-surface-low opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    {iconMap[sec.icon] || <Layout size={18} />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-primary">{sec.label}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-outline bg-surface-low px-2 py-0.5 rounded-lg">
                        ترتیب {sec.order}
                      </span>
                      {sec.visible ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">فعال</span>
                      ) : (
                        <span className="text-xs text-outline bg-surface-low px-2 py-0.5 rounded-lg">مخفی</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleVisibility(sec.slug)}
                    className={`p-2 rounded-lg transition-colors ${
                      sec.visible
                        ? "text-primary hover:bg-surface-container"
                        : "text-outline hover:text-primary hover:bg-surface-container"
                    }`}
                    title={sec.visible ? "مخفی کردن بخش" : "نمایش بخش"}
                  >
                    {sec.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => updateOrder(sec.slug, "up")}
                    disabled={index === 0}
                    className="p-2 rounded-lg text-outline hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => updateOrder(sec.slug, "down")}
                    disabled={index === sections.length - 1}
                    className="p-2 rounded-lg text-outline hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-surface-variant flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-outline">
            <CheckCircle2 size={14} className="text-green-600" />
            بخش‌ها به ترتیب نمایش مرتب شده‌اند
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            ذخیره تغییرات
          </button>
        </div>
      </div>
    </div>
  );
}
