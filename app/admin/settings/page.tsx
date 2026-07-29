"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageUpload from "@/components/ui/ImageUpload";

interface SiteSettings {
  siteName: string;
  siteLogo: string | null;
  siteFont: string;
  sidebarColor: string;
  sidebarLayout: string;
  bgColor: string;
  bgPattern: string | null;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const getToken = () => getCookie("token") || "";

  const fetchSettings = () => {
    setLoading(true);
    fetch("/api/site-settings")
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("پاسخ سرور نامعتبر است (لطفا از اجرای npx prisma db push و npm run build اطمینان حاصل کنید)");
        }
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSettings(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
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
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(settings),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("پاسخ سرور نامعتبر است (HTML). لطفا کنسول سرور را بررسی کنید.");
      }
      if (!res.ok || data.error) throw new Error(data.error || "خطا در ذخیره");
      setSettings(data);
      toast.success("تنظیمات ذخیره شد");
    } catch (e: any) {
      console.error("Settings save error:", e);
      toast.error(e.message || "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-error gap-3">
        <AlertCircle size={40} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">تنظیمات سایت</h2>
      </div>

      <div className="bg-white rounded-2xl p-6 space-y-6 shadow-sm border border-surface-variant">
        <h3 className="font-bold text-primary text-lg">اطلاعات سایت</h3>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">نام سایت</label>
          <input
            type="text"
            value={settings?.siteName || ""}
            onChange={(e) => updateField("siteName", e.target.value)}
            className="w-full rounded-xl border border-surface-variant px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-fixed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">لوگوی سایت</label>
          <ImageUpload
            value={settings?.siteLogo || ""}
            onChange={(url) => updateField("siteLogo", url)}
            label="آپلود لوگو"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">رنگ پس زمینه سایت</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={settings?.bgColor || "#fbf8ff"}
              onChange={(e) => updateField("bgColor", e.target.value)}
              className="w-12 h-12 rounded-xl cursor-pointer border border-surface-variant"
            />
            <span className="text-sm text-outline font-mono">{settings?.bgColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">تصویر پس زمینه (اختیاری)</label>
          <ImageUpload
            value={settings?.bgPattern || ""}
            onChange={(url) => updateField("bgPattern", url)}
            label="آپلود تصویر پس زمینه"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 space-y-6 shadow-sm border border-surface-variant">
        <h3 className="font-bold text-primary text-lg">قلم (فونت) سایت</h3>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">فونت انتخابی</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateField("siteFont", "foran")}
              className={`p-4 rounded-xl border-2 text-right transition-all ${
                settings?.siteFont === "foran"
                  ? "border-primary bg-primary/5"
                  : "border-surface-variant hover:border-primary/30"
              }`}
            >
              <span className="block font-bold text-primary">فونت Foran</span>
              <span className="text-sm text-outline font-foran">نمایش متن با فونت فوران</span>
            </button>
            <button
              onClick={() => updateField("siteFont", "kay")}
              className={`p-4 rounded-xl border-2 text-right transition-all ${
                settings?.siteFont === "kay"
                  ? "border-primary bg-primary/5"
                  : "border-surface-variant hover:border-primary/30"
              }`}
            >
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
            <input
              type="color"
              value={settings?.sidebarColor || "#03004b"}
              onChange={(e) => updateField("sidebarColor", e.target.value)}
              className="w-12 h-12 rounded-xl cursor-pointer border border-surface-variant"
            />
            <span className="text-sm text-outline font-mono">{settings?.sidebarColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">نوع چینش سایدبار</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateField("sidebarLayout", "default")}
              className={`p-4 rounded-xl border-2 text-right transition-all ${
                settings?.sidebarLayout === "default"
                  ? "border-primary bg-primary/5"
                  : "border-surface-variant hover:border-primary/30"
              }`}
            >
              <span className="block font-bold text-primary">چینش پیش‌فرض</span>
              <span className="text-sm text-outline">آیکون + متن</span>
            </button>
            <button
              onClick={() => updateField("sidebarLayout", "compact")}
              className={`p-4 rounded-xl border-2 text-right transition-all ${
                settings?.sidebarLayout === "compact"
                  ? "border-primary bg-primary/5"
                  : "border-surface-variant hover:border-primary/30"
              }`}
            >
              <span className="block font-bold text-primary">چینش فشرده</span>
              <span className="text-sm text-outline">فقط آیکون (کوچک)</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </button>
      </div>
    </div>
  );
}
