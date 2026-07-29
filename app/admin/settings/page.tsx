"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle, Settings, Layout, CheckCircle2, Eye, EyeOff, ChevronUp, ChevronDown, Sliders, BookOpen, Users, Camera, Megaphone } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import { HomeSectionContent, homeSectionDefinitions, parseHomeSectionContent } from "@/lib/home-sections";

interface SiteSettings {
  siteName: string;
  siteLogo: string | null;
  siteFont: string;
  sidebarColor: string;
  sidebarLayout: string;
  bgColor: string;
  bgPattern: string | null;
}

interface SectionMeta {
  id: string;
  slug: string;
  label: string;
  icon: string;
  order: number;
  visible: boolean;
  content: HomeSectionContent;
}

const defaultSections: SectionMeta[] = homeSectionDefinitions.map((section) => ({
  id: "",
  slug: section.slug,
  label: section.label,
  icon: section.icon,
  order: section.order,
  visible: true,
  content: { ...section.defaults },
}));

const iconMap: Record<string, React.ReactNode> = {
  Sliders: <Sliders size={18} />,
  Layout: <Layout size={18} />,
  BookOpen: <BookOpen size={18} />,
  Users: <Users size={18} />,
  Camera: <Camera size={18} />,
  Megaphone: <Megaphone size={18} />,
};

export default function AdminSettings() {
  const [tab, setTab] = useState<"settings" | "pagebuilder">("settings");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sections, setSections] = useState<SectionMeta[]>(defaultSections);
  const [pbLoading, setPbLoading] = useState(true);
  const [pbSaving, setPbSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const getToken = () => getCookie("token") || "";

  const fetchSettings = () => {
    setLoading(true);
    fetch("/api/site-settings")
      .then(async (r) => {
        const text = await r.text();
        try { return JSON.parse(text); }
        catch { throw new Error("پاسخ سرور نامعتبر است"); }
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSettings(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const fetchSections = () => {
    const token = getToken();
    if (!token) { setPbLoading(false); return; }
    fetch("/api/page-builder", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const serverSections = data.sections || [];
        if (serverSections.length > 0) {
          const merged = defaultSections.map((def) => {
            const match = serverSections.find((s: SectionMeta) => s.slug === def.slug);
            return match
              ? { ...def, id: match.id, order: match.order, visible: match.visible, content: parseHomeSectionContent(def.slug, match.content) }
              : def;
          });
          setSections(merged.sort((a, b) => a.order - b.order));
        }
        setPbLoading(false);
      })
      .catch(() => setPbLoading(false));
  };

  useEffect(() => {
    fetchSettings();
    fetchSections();
  }, []);

  const updateField = (key: keyof SiteSettings, value: string | null) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(settings),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("پاسخ سرور نامعتبر است"); }
      if (!res.ok || data.error) throw new Error(data.error || "خطا در ذخیره");
      setSettings(data);
      toast.success("تنظیمات ذخیره شد");
    } catch (e: any) {
      toast.error(e.message || "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

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
    setSections((prev) => prev.map((s) => (s.slug === slug ? { ...s, visible: !s.visible } : s)));
  };

  const updateSectionContent = (slug: string, key: string, value: string | number) => {
    setSections((prev) => prev.map((section) => (
      section.slug === slug
        ? { ...section, content: { ...section.content, [key]: value } }
        : section
    )));
  };

  const saveSections = async () => {
    setPbSaving(true);
    const token = getToken();
    try {
      const promises = sections.map((sec) =>
        fetch("/api/page-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ slug: sec.slug, content: JSON.stringify(sec.content), order: sec.order, visible: sec.visible }),
        }).then(async (r) => {
          if (!r.ok) {
            const data = await r.json().catch(() => null);
            throw new Error(data?.error || `خطا در ذخیره ${sec.label}`);
          }
        })
      );
      await Promise.all(promises);
      toast.success("تمامی بخش‌ها ذخیره شدند");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setPbSaving(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-error gap-3">
        <AlertCircle size={40} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">تنظیمات سایت</h2>
      </div>

      <div className="flex gap-1 bg-surface-low rounded-2xl p-1 border border-surface-variant">
        <button
          onClick={() => setTab("settings")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${tab === "settings" ? "bg-white text-primary shadow-sm" : "text-outline hover:text-primary"}`}
        >
          <Settings size={18} /> اطلاعات سایت
        </button>
        <button
          onClick={() => setTab("pagebuilder")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${tab === "pagebuilder" ? "bg-white text-primary shadow-sm" : "text-outline hover:text-primary"}`}
        >
          <Layout size={18} /> ویرایش صفحه اصلی
        </button>
      </div>

      {tab === "settings" && settings && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 space-y-6 shadow-sm border border-surface-variant">
            <h3 className="font-bold text-primary text-lg">اطلاعات سایت</h3>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">نام سایت</label>
              <input type="text" value={settings.siteName} onChange={(e) => updateField("siteName", e.target.value)}
                className="w-full rounded-xl border border-surface-variant px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">لوگوی سایت</label>
              <ImageUpload value={settings.siteLogo || ""} onChange={(url) => updateField("siteLogo", url)} label="آپلود لوگو" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">رنگ پس زمینه سایت</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={settings.bgColor} onChange={(e) => updateField("bgColor", e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border border-surface-variant" />
                <span className="text-sm text-outline font-mono">{settings.bgColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">تصویر پس زمینه (اختیاری)</label>
              <ImageUpload value={settings.bgPattern || ""} onChange={(url) => updateField("bgPattern", url)} label="آپلود تصویر پس زمینه" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 space-y-6 shadow-sm border border-surface-variant">
            <h3 className="font-bold text-primary text-lg">قلم (فونت) سایت</h3>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">فونت انتخابی</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateField("siteFont", "foran")}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${settings.siteFont === "foran" ? "border-primary bg-primary/5" : "border-surface-variant hover:border-primary/30"}`}>
                  <span className="block font-bold text-primary">فونت Foran</span>
                  <span className="text-sm text-outline font-foran">نمایش متن با فونت فوران</span>
                </button>
                <button onClick={() => updateField("siteFont", "kay")}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${settings.siteFont === "kay" ? "border-primary bg-primary/5" : "border-surface-variant hover:border-primary/30"}`}>
                  <span className="block font-bold text-primary">فونت Kay</span>
                  <span className="text-sm text-outline font-kay">نمایش متن با فونت کی</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 space-y-6 shadow-sm border border-surface-variant">
            <h3 className="font-bold text-primary text-lg">سایدبار (منوی کناری)</h3>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">رنگ سایدبار</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={settings.sidebarColor} onChange={(e) => updateField("sidebarColor", e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border border-surface-variant" />
                <span className="text-sm text-outline font-mono">{settings.sidebarColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">نوع چینش سایدبار</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateField("sidebarLayout", "default")}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${settings.sidebarLayout === "default" ? "border-primary bg-primary/5" : "border-surface-variant hover:border-primary/30"}`}>
                  <span className="block font-bold text-primary">چینش پیش‌فرض</span>
                  <span className="text-sm text-outline">آیکون + متن</span>
                </button>
                <button onClick={() => updateField("sidebarLayout", "compact")}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${settings.sidebarLayout === "compact" ? "border-primary bg-primary/5" : "border-surface-variant hover:border-primary/30"}`}>
                  <span className="block font-bold text-primary">چینش فشرده</span>
                  <span className="text-sm text-outline">فقط آیکون (کوچک)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
            </button>
          </div>
        </div>
      )}

      {tab === "pagebuilder" && (
        <div className="bg-white rounded-2xl border border-surface-variant shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-primary">ویرایش صفحه اصلی</h3>
              <p className="text-sm text-outline mt-0.5">محتوا، نمایش و ترتیب بخش‌های صفحه اصلی را مدیریت کنید</p>
            </div>
            <button onClick={saveSections} disabled={pbSaving}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {pbSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              ذخیره تغییرات
            </button>
          </div>

          {pbLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {sections.map((sec, index) => {
                const definition = homeSectionDefinitions.find((item) => item.slug === sec.slug);
                const isExpanded = expandedSection === sec.slug;
                return (
                <div key={sec.slug}
                  className={`border border-surface-variant rounded-2xl p-4 transition-all ${sec.visible ? "bg-white" : "bg-surface-low opacity-60"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                        {iconMap[sec.icon] || <Layout size={18} />}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-primary">{sec.label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-outline bg-surface-low px-2 py-0.5 rounded-lg">ترتیب {sec.order}</span>
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
                        type="button"
                        onClick={() => setExpandedSection(isExpanded ? null : sec.slug)}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-secondary hover:bg-secondary-fixed/20 transition-colors"
                      >
                        {isExpanded ? "بستن ویرایش" : "ویرایش محتوا"}
                      </button>
                      <button onClick={() => toggleVisibility(sec.slug)}
                        className={`p-2 rounded-lg transition-colors ${sec.visible ? "text-primary hover:bg-surface-container" : "text-outline hover:text-primary hover:bg-surface-container"}`}>
                        {sec.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => updateOrder(sec.slug, "up")} disabled={index === 0}
                        className="p-2 rounded-lg text-outline hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronUp size={16} />
                      </button>
                      <button onClick={() => updateOrder(sec.slug, "down")} disabled={index === sections.length - 1}
                        className="p-2 rounded-lg text-outline hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && definition && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-surface-variant">
                      {definition.fields.map((field) => {
                        const value = sec.content[field.key] ?? "";
                        const fullWidth = field.type === "textarea" || field.key === "imageUrl";
                        return (
                          <div key={field.key} className={fullWidth ? "md:col-span-2" : ""}>
                            <label className="block text-sm font-medium text-primary mb-1.5">{field.label}</label>
                            {field.key === "imageUrl" ? (
                              <ImageUpload
                                value={String(value)}
                                onChange={(url) => updateSectionContent(sec.slug, field.key, url)}
                                label="تصویر پس‌زمینه هیرو"
                                aspectRatio="16:9"
                              />
                            ) : field.type === "textarea" ? (
                              <textarea
                                rows={3}
                                value={String(value)}
                                onChange={(event) => updateSectionContent(sec.slug, field.key, event.target.value)}
                                className="w-full rounded-xl border border-surface-variant px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-fixed resize-y"
                              />
                            ) : (
                              <input
                                type={field.type === "number" ? "number" : "text"}
                                min={field.type === "number" ? 0 : undefined}
                                value={value}
                                dir={field.type === "url" ? "ltr" : undefined}
                                onChange={(event) => updateSectionContent(
                                  sec.slug,
                                  field.key,
                                  field.type === "number" ? Math.max(0, Number(event.target.value) || 0) : event.target.value,
                                )}
                                className="w-full rounded-xl border border-surface-variant px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-fixed"
                              />
                            )}
                          </div>
                        );
                      })}
                      {sec.slug === "hero" && (
                        <p className="md:col-span-2 text-xs text-outline bg-surface-low rounded-xl p-3">
                          این محتوا زمانی نمایش داده می‌شود که اسلاید منتشرشده‌ای وجود نداشته باشد. محتوای هر اسلاید از بخش «اسلایدر» مدیریت می‌شود.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-surface-variant flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-outline">
              <CheckCircle2 size={14} className="text-green-600" /> بخش‌ها به ترتیب نمایش مرتب شده‌اند
            </div>
            <button onClick={saveSections} disabled={pbSaving}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {pbSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} ذخیره تغییرات
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
