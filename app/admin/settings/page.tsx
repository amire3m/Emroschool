"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle, Settings, Layout, CheckCircle2, Eye, EyeOff, ChevronUp, ChevronDown, Sliders, BookOpen, Users, Camera, Megaphone } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";
import { HomeSectionContent, homeSectionDefinitions, parseHomeSectionContent } from "@/lib/home-sections";
import { PageHeader, Badge, PrimaryButton } from "@/components/admin/ui";

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

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "rounded-lg p-2 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const pickerBtnBase = "rounded-xl border-2 p-4 text-right transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const pickerBtnActive = "border-[#03004b] bg-[#03004b]/5";
const pickerBtnIdle = "border-slate-200 hover:border-[#03004b]/30";

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
        <Loader2 className="animate-spin text-[#03004b]" size={40} />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-600 gap-3">
        <AlertCircle size={40} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="تنظیمات سایت" />

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${tab === "settings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
        >
          <Settings size={18} /> اطلاعات سایت
        </button>
        <button
          type="button"
          onClick={() => setTab("pagebuilder")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${tab === "pagebuilder" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
        >
          <Layout size={18} /> ویرایش صفحه اصلی
        </button>
      </div>

      {tab === "settings" && settings && (
        <div className="space-y-5">
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-black text-slate-900">اطلاعات سایت</h2>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-900">نام سایت</label>
              <input type="text" value={settings.siteName} onChange={(e) => updateField("siteName", e.target.value)}
                className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">لوگوی سایت</label>
              <ImageUpload value={settings.siteLogo || ""} onChange={(url) => updateField("siteLogo", url)} label="آپلود لوگو" sizeHint="۵۱۲ × ۵۱۲ پیکسل" aspectRatio="1:1" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">رنگ پس زمینه سایت</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={settings.bgColor} onChange={(e) => updateField("bgColor", e.target.value)}
                  className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]" />
                <span className="text-sm tabular-nums text-slate-500" dir="ltr">{settings.bgColor}</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">تصویر پس زمینه (اختیاری)</label>
              <ImageUpload value={settings.bgPattern || ""} onChange={(url) => updateField("bgPattern", url)} label="آپلود تصویر پس زمینه" sizeHint="۱۹۲۰ × ۱۰۸۰ پیکسل" aspectRatio="16:9" />
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-black text-slate-900">قلم (فونت) سایت</h2>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">فونت انتخابی</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button type="button" onClick={() => updateField("siteFont", "foran")}
                  className={`${pickerBtnBase} ${settings.siteFont === "foran" ? pickerBtnActive : pickerBtnIdle}`}>
                  <span className="block font-bold text-slate-900">فونت دوران</span>
                  <span className="text-sm text-slate-500 font-foran">نمایش متن با فونت دوران</span>
                </button>
                <button type="button" onClick={() => updateField("siteFont", "kay")}
                  className={`${pickerBtnBase} ${settings.siteFont === "kay" ? pickerBtnActive : pickerBtnIdle}`}>
                  <span className="block font-bold text-slate-900">فونت ری</span>
                  <span className="text-sm text-slate-500 font-kay">نمایش متن با فونت ری</span>
                </button>
                <button type="button" onClick={() => updateField("siteFont", "ravagh")}
                  className={`${pickerBtnBase} ${settings.siteFont === "ravagh" ? pickerBtnActive : pickerBtnIdle}`}>
                  <span className="block font-bold text-slate-900">فونت رواق</span>
                  <span className="text-sm text-slate-500 font-ravagh">نمایش متن با فونت رواق و اعداد فارسی</span>
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-black text-slate-900">سایدبار (منوی کناری)</h2>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">رنگ سایدبار</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={settings.sidebarColor} onChange={(e) => updateField("sidebarColor", e.target.value)}
                  className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]" />
                <span className="text-sm tabular-nums text-slate-500" dir="ltr">{settings.sidebarColor}</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-900">نوع چینش سایدبار</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => updateField("sidebarLayout", "default")}
                  className={`${pickerBtnBase} ${settings.sidebarLayout === "default" ? pickerBtnActive : pickerBtnIdle}`}>
                  <span className="block font-bold text-slate-900">چینش پیش‌فرض</span>
                  <span className="text-sm text-slate-500">آیکون + متن</span>
                </button>
                <button type="button" onClick={() => updateField("sidebarLayout", "compact")}
                  className={`${pickerBtnBase} ${settings.sidebarLayout === "compact" ? pickerBtnActive : pickerBtnIdle}`}>
                  <span className="block font-bold text-slate-900">چینش فشرده</span>
                  <span className="text-sm text-slate-500">فقط آیکون (کوچک)</span>
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {tab === "pagebuilder" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">ویرایش صفحه اصلی</h2>
              <p className="mt-1 text-xs text-slate-500">محتوا، نمایش و ترتیب بخش‌های صفحه اصلی را مدیریت کنید</p>
            </div>
            <PrimaryButton onClick={saveSections} disabled={pbSaving}>
              {pbSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              ذخیره تغییرات
            </PrimaryButton>
          </div>

          {pbLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-[#03004b]" /></div>
          ) : (
            <div className="space-y-3">
              {sections.map((sec, index) => {
                const definition = homeSectionDefinitions.find((item) => item.slug === sec.slug);
                const isExpanded = expandedSection === sec.slug;
                return (
                <div key={sec.slug}
                  className={`rounded-xl border border-slate-200 p-4 transition-all ${sec.visible ? "bg-white" : "bg-slate-50 opacity-60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        {iconMap[sec.icon] || <Layout size={18} />}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-900">{sec.label}</span>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">ترتیب {sec.order}</span>
                          <Badge tone={sec.visible ? "emerald" : "slate"}>{sec.visible ? "فعال" : "مخفی"}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setExpandedSection(isExpanded ? null : sec.slug)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"
                      >
                        {isExpanded ? "بستن ویرایش" : "ویرایش محتوا"}
                      </button>
                      <button type="button" onClick={() => toggleVisibility(sec.slug)} aria-label={sec.visible ? "مخفی کردن" : "نمایش"}
                        className={iconBtnCls}>
                        {sec.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button type="button" onClick={() => updateOrder(sec.slug, "up")} disabled={index === 0} aria-label="انتقال به بالا"
                        className={iconBtnCls}>
                        <ChevronUp size={16} />
                      </button>
                      <button type="button" onClick={() => updateOrder(sec.slug, "down")} disabled={index === sections.length - 1} aria-label="انتقال به پایین"
                        className={iconBtnCls}>
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && definition && (
                    <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
                      {definition.fields.map((field) => {
                        const value = sec.content[field.key] ?? "";
                        const fullWidth = field.type === "textarea" || field.key === "imageUrl";
                        return (
                          <div key={field.key} className={fullWidth ? "md:col-span-2" : ""}>
                            <label className="mb-1.5 block text-sm font-bold text-slate-900">{field.label}</label>
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
                                className={`w-full resize-y leading-7 ${inputCls}`}
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
                                className={`w-full tabular-nums ${inputCls}`}
                              />
                            )}
                          </div>
                        );
                      })}
                      {sec.slug === "hero" && (
                        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 md:col-span-2">
                          این محتوا زمانی نمایش داده می‌شود که اسلاید منتشرشده‌ای وجود نداشته باشد. محتوای هر اسلاید از بخش «اسلایدر» مدیریت می‌شود.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 size={14} className="text-emerald-600" /> بخش‌ها به ترتیب نمایش مرتب شده‌اند
            </div>
            <PrimaryButton onClick={saveSections} disabled={pbSaving}>
              {pbSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} ذخیره تغییرات
            </PrimaryButton>
          </div>
        </section>
      )}
    </div>
  );
}
