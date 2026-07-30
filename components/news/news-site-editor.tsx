"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, FileText, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import ImageUpload from "@/components/ui/ImageUpload";
import { getCookie } from "@/lib/cookie";

const categories = [{ value: "general", label: "خبر آکادمی" }, { value: "course", label: "دوره‌ها" }, { value: "instructor", label: "اساتید" }, { value: "alumni", label: "هنرآموختگان" }];

function toSlug(value: string) {
  const map: Record<string, string> = { ا: "a", آ: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n", و: "v", ه: "h", ی: "y", " ": "-" };
  return [...value].map((character) => map[character] || character).join("").replace(/[^a-zA-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export default function NewsSiteEditor({ onClose, onCreated }: { onClose: () => void; onCreated: (result: { title: string; slug: string; published: boolean }) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "", content: "", coverImage: "", category: "general", authorName: "", tags: "", featured: false });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const published = submitter?.value === "publish";
    setSaving(true);
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${getCookie("token") || ""}` },
        body: JSON.stringify({ ...form, published }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در ذخیره خبر");
      if (!published) toast.success("پیش‌نویس ذخیره شد");
      onCreated({ title: data.newsPost.title, slug: data.newsPost.slug, published });
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در ذخیره خبر"); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[100] bg-primary/80 backdrop-blur-xl p-3 md:p-8 overflow-y-auto" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form onSubmit={save} className="relative max-w-5xl mx-auto bg-[#fbf8ff] rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up">
      <div className="bg-primary text-white px-6 md:px-9 py-6 flex items-center justify-between"><div className="flex items-center gap-4"><span className="w-11 h-11 rounded-2xl bg-secondary-fixed text-primary flex items-center justify-center rotate-3"><FileText size={21} /></span><div><h2 className="text-xl font-black">نوشتن یک روایت تازه</h2><p className="text-xs text-white/50 mt-1">بدون خروج از مجله بنویسید و منتشر کنید.</p></div></div><button type="button" onClick={onClose} disabled={saving} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10"><X size={19} /></button></div>
      <div className="p-6 md:p-9 grid md:grid-cols-2 gap-5">
        <label className="md:col-span-2 text-sm font-bold text-primary">عنوان روایت<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: toSlug(event.target.value) }))} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" placeholder="عنوانی که مخاطب را متوقف کند..." /></label>
        <label className="text-sm font-bold text-primary">آدرس صفحه<div className="mt-2 flex" dir="ltr"><span className="px-2 py-3 rounded-l-xl border border-r-0 border-surface-variant bg-surface-low text-[10px] text-outline">mag.imamruhollahschool.com/news/</span><input required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} className="min-w-0 flex-1 px-3 py-3 rounded-r-xl border border-surface-variant bg-white font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" /></div></label>
        <label className="text-sm font-bold text-primary">موضوع<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white font-normal">{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="md:col-span-2 text-sm font-bold text-primary">خلاصه<input required maxLength={300} value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" placeholder="در دو جمله بگویید این روایت درباره چیست..." /></label>
        <label className="md:col-span-2 text-sm font-bold text-primary">متن کامل<textarea required rows={12} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white font-normal leading-8 outline-none focus:ring-2 focus:ring-secondary-fixed resize-y" placeholder="بین پاراگراف‌ها یک خط خالی بگذارید..." /></label>
        <div className="md:col-span-2"><ImageUpload value={form.coverImage} onChange={(coverImage) => setForm((current) => ({ ...current, coverImage }))} label="تصویر شاخص روایت" sizeHint="تصویر افقی 16:9" aspectRatio="16:9" /></div>
        <label className="text-sm font-bold text-primary">نام نویسنده<input value={form.authorName} onChange={(event) => setForm((current) => ({ ...current, authorName: event.target.value }))} placeholder="تحریریه آکادمی" className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white font-normal" /></label>
        <label className="text-sm font-bold text-primary">برچسب‌ها<input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="آموزش، سینما، تجربه" className="mt-2 w-full px-4 py-3 rounded-xl border border-surface-variant bg-white font-normal" /></label>
        <label className="md:col-span-2 flex items-center justify-between p-4 rounded-2xl bg-white border border-surface-variant"><div><p className="text-sm font-bold text-primary">نمایش به‌عنوان روایت ویژه</p><p className="text-xs text-outline mt-1">در ابتدای صفحه مجله با اندازه بزرگ نمایش داده می‌شود.</p></div><input type="checkbox" checked={form.featured} onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))} className="w-5 h-5 accent-primary" /></label>
      </div>
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-surface-variant px-6 md:px-9 py-4 flex flex-wrap gap-3 justify-end"><button type="submit" value="draft" disabled={saving} className="px-5 py-2.5 rounded-xl border border-surface-variant text-sm font-bold text-outline flex items-center gap-2"><Check size={16} />ذخیره پیش‌نویس</button><button type="submit" value="publish" disabled={saving} className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}انتشار همین حالا</button></div>
    </form>
  </div>;
}
