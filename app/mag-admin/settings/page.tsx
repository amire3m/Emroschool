"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Settings } from "lucide-react";
import toast from "react-hot-toast";
import ImageUpload from "@/components/ui/ImageUpload";
import { getCookie } from "@/lib/cookie";

interface MagazineSettings { title: string; description: string; logo: string | null; heroLabel: string; heroTitle: string; heroHighlight: string; heroDescription: string; accentColor: string; }

export default function MagazineSettingsPage() {
  const [settings, setSettings] = useState<MagazineSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/magazine-settings").then((response) => response.json()).then((data) => { if (!data.error) setSettings(data); }).finally(() => setLoading(false)); }, []);
  function update<K extends keyof MagazineSettings>(key: K, value: MagazineSettings[K]) { setSettings((current) => current ? { ...current, [key]: value } : current); }
  async function save() { if (!settings) return; setSaving(true); try { const response = await fetch("/api/magazine-settings", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${getCookie("token") || ""}` }, body: JSON.stringify(settings) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "خطا در ذخیره تنظیمات"); setSettings(data); toast.success("تنظیمات مجله ذخیره شد"); } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در ذخیره تنظیمات"); } finally { setSaving(false); } }
  if (loading || !settings) return <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-primary" size={34} /></div>;
  return <div className="max-w-4xl mx-auto space-y-5"><div className="bg-primary text-white rounded-[1.7rem] p-6 flex items-center gap-4"><span className="w-12 h-12 rounded-2xl bg-secondary-fixed text-primary flex items-center justify-center"><Settings size={22} /></span><div><h1 className="font-black text-lg">هویت مستقل مجله</h1><p className="text-xs text-white/50 mt-1">این تنظیمات فقط روی ساب‌دامین مجله اعمال می‌شوند.</p></div></div><div className="bg-white rounded-[1.7rem] border border-surface-variant p-5 md:p-7 grid md:grid-cols-2 gap-5">
    <label className="md:col-span-2 text-sm font-bold text-primary">عنوان مجله<input value={settings.title} onChange={(event) => update("title", event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" /></label>
    <label className="md:col-span-2 text-sm font-bold text-primary">توضیح کوتاه<textarea rows={2} value={settings.description} onChange={(event) => update("description", event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" /></label>
    <div className="md:col-span-2"><ImageUpload value={settings.logo || ""} onChange={(value) => update("logo", value || null)} label="لوگوی مجله" sizeHint="ترجیحاً لوگوی افقی با پس‌زمینه شفاف" aspectRatio="3:1" /></div>
    <label className="md:col-span-2 text-sm font-bold text-primary">برچسب بالای Hero<input value={settings.heroLabel} onChange={(event) => update("heroLabel", event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal" /></label>
    <label className="text-sm font-bold text-primary">خط اول تیتر<input value={settings.heroTitle} onChange={(event) => update("heroTitle", event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal" /></label><label className="text-sm font-bold text-primary">خط طلایی تیتر<input value={settings.heroHighlight} onChange={(event) => update("heroHighlight", event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal" /></label>
    <label className="md:col-span-2 text-sm font-bold text-primary">توضیح Hero<textarea rows={3} value={settings.heroDescription} onChange={(event) => update("heroDescription", event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal leading-7" /></label><label className="text-sm font-bold text-primary">رنگ تأکیدی<input type="color" value={settings.accentColor} onChange={(event) => update("accentColor", event.target.value)} className="mt-2 block w-full h-12 rounded-xl border border-surface-variant bg-white p-1" /></label>
    <div className="md:col-span-2 pt-2"><button onClick={save} disabled={saving} className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}ذخیره تنظیمات مجله</button></div>
  </div></div>;
}
