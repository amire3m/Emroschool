"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Eye, Loader2, Newspaper, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import ImageUpload from "@/components/ui/ImageUpload";
import { getCookie } from "@/lib/cookie";

interface NewsPost { id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string | null; category: string; authorName: string | null; tags: string | null; featured: boolean; published: boolean; publishedAt: string | null; createdAt: string; }
const categories = [{ value: "general", label: "خبر آکادمی" }, { value: "course", label: "دوره‌ها" }, { value: "instructor", label: "اساتید" }, { value: "alumni", label: "هنرآموختگان" }];
const emptyForm = { title: "", slug: "", excerpt: "", content: "", coverImage: "", category: "general", authorName: "", tags: "", featured: false, published: false };

function toSlug(value: string) {
  const map: Record<string, string> = { ا: "a", آ: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n", و: "v", ه: "h", ی: "y", " ": "-" };
  return [...value].map((character) => map[character] || character).join("").replace(/[^a-zA-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const token = () => getCookie("token") || "";

  async function fetchNews() {
    setLoading(true);
    try {
      const response = await fetch("/api/news", { headers: { authorization: `Bearer ${token()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در دریافت اخبار");
      setNews(data.news || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در دریافت اخبار"); }
    finally { setLoading(false); }
  }
  useEffect(() => { fetchNews(); }, []);

  function openCreate() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(post: NewsPost) { setEditing(post); setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, coverImage: post.coverImage || "", category: post.category, authorName: post.authorName || "", tags: post.tags || "", featured: post.featured, published: post.published }); setModalOpen(true); }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch(editing ? `/api/news/${editing.id}` : "/api/news", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${token()}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در ذخیره خبر");
      toast.success(editing ? "خبر بروزرسانی شد" : "خبر ایجاد شد"); setModalOpen(false); await fetchNews();
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در ذخیره خبر"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return; setSaving(true);
    try { const response = await fetch(`/api/news/${deleteTarget.id}`, { method: "DELETE", headers: { authorization: `Bearer ${token()}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "خطا در حذف خبر"); toast.success("خبر حذف شد"); setDeleteTarget(null); await fetchNews(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "خطا در حذف خبر"); }
    finally { setSaving(false); }
  }

  const filtered = news.filter((post) => post.title.includes(search) || post.excerpt.includes(search) || post.tags?.includes(search));
  return <div className="space-y-5">
    <div className="flex flex-col sm:flex-row gap-3 justify-between"><div className="relative sm:w-72"><Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در اخبار..." className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant bg-white text-sm outline-none focus:ring-2 focus:ring-secondary-fixed" /></div><button onClick={openCreate} className="flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold"><Plus size={18} />خبر جدید</button></div>
    {loading ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div> : filtered.length === 0 ? <div className="bg-white rounded-2xl border border-surface-variant py-20 text-center text-outline"><Newspaper size={42} className="mx-auto mb-3 opacity-30" /><p>خبری پیدا نشد</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((post) => <article key={post.id} className="bg-white rounded-2xl border border-surface-variant overflow-hidden group"><div className="aspect-[16/8] bg-surface-low relative overflow-hidden">{post.coverImage ? <img src={post.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center text-outline-variant"><Newspaper size={42} /></div>}<div className="absolute top-3 right-3 flex gap-2">{post.featured && <span className="bg-secondary-fixed text-secondary rounded-full p-1.5"><Star size={13} className="fill-current" /></span>}<span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${post.published ? "bg-green-600 text-white" : "bg-white text-outline"}`}>{post.published ? "منتشرشده" : "پیش‌نویس"}</span></div></div><div className="p-4"><span className="text-[11px] font-bold text-secondary">{categories.find((item) => item.value === post.category)?.label}</span><h2 className="font-black text-primary mt-1 line-clamp-2 leading-7">{post.title}</h2><p className="text-xs text-outline line-clamp-2 leading-6 mt-1">{post.excerpt}</p><div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-variant"><span className="text-[10px] text-outline flex items-center gap-1"><CalendarDays size={12} />{new Date(post.publishedAt || post.createdAt).toLocaleDateString("fa-IR")}</span><div className="flex gap-1">{post.published && <Link href={`/news/${post.slug}`} target="_blank" className="p-2 text-outline hover:text-primary"><Eye size={16} /></Link>}<button onClick={() => openEdit(post)} className="p-2 text-outline hover:text-primary"><Pencil size={16} /></button><button onClick={() => setDeleteTarget(post)} className="p-2 text-outline hover:text-error"><Trash2 size={16} /></button></div></div></div></article>)}</div>}

    {modalOpen && <div className="modal-overlay" onClick={() => !saving && setModalOpen(false)}><form onSubmit={save} className="modal-content max-w-4xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-black text-primary">{editing ? "ویرایش خبر" : "روایت تازه"}</h2><p className="text-xs text-outline mt-1">متن را با یک خط خالی بین پاراگراف‌ها بنویسید.</p></div><button type="button" onClick={() => setModalOpen(false)} className="p-2 text-outline"><X size={20} /></button></div><div className="grid md:grid-cols-2 gap-4">
      <label className="md:col-span-2 text-sm font-bold text-primary">عنوان<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: editing ? current.slug : toSlug(event.target.value) }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" /></label>
      <label className="text-sm font-bold text-primary">آدرس صفحه در مجله<div className="mt-1 flex" dir="ltr"><span className="px-2 py-3 rounded-l-xl border border-r-0 border-surface-variant bg-surface-low text-[10px] text-outline">mag.imamruhollahschool.com/news/</span><input required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} className="min-w-0 flex-1 px-3 py-3 rounded-r-xl border border-surface-variant font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" /></div></label>
      <label className="text-sm font-bold text-primary">موضوع<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal">{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="md:col-span-2 text-sm font-bold text-primary">خلاصه<input required value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} maxLength={300} className="mt-1 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal outline-none focus:ring-2 focus:ring-secondary-fixed" /></label>
      <label className="md:col-span-2 text-sm font-bold text-primary">متن خبر<textarea required rows={11} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal leading-8 outline-none focus:ring-2 focus:ring-secondary-fixed resize-y" /></label>
      <div className="md:col-span-2"><ImageUpload value={form.coverImage} onChange={(coverImage) => setForm((current) => ({ ...current, coverImage }))} label="تصویر شاخص" sizeHint="پیشنهاد: تصویر افقی با نسبت 16:9" aspectRatio="16:9" /></div>
      <label className="text-sm font-bold text-primary">نام نویسنده<input value={form.authorName} onChange={(event) => setForm((current) => ({ ...current, authorName: event.target.value }))} placeholder="تحریریه آکادمی" className="mt-1 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal" /></label><label className="text-sm font-bold text-primary">برچسب‌ها<input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="هنر، رسانه، آموزش" className="mt-1 w-full px-4 py-3 rounded-xl border border-surface-variant font-normal" /></label>
      <label className="flex items-center justify-between rounded-xl bg-surface-low border border-surface-variant p-3"><span className="text-sm font-bold text-primary">روایت ویژه</span><input type="checkbox" checked={form.featured} onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))} className="w-5 h-5 accent-primary" /></label><label className="flex items-center justify-between rounded-xl bg-surface-low border border-surface-variant p-3"><span className="text-sm font-bold text-primary">انتشار عمومی</span><input type="checkbox" checked={form.published} onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))} className="w-5 h-5 accent-primary" /></label>
    </div><div className="flex gap-3 mt-6"><button disabled={saving} className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{editing ? "ذخیره تغییرات" : "ایجاد خبر"}</button><button type="button" onClick={() => setModalOpen(false)} className="px-6 py-3 rounded-xl border border-surface-variant text-sm text-outline">انصراف</button></div></form></div>}
    {deleteTarget && <div className="modal-overlay" onClick={() => !saving && setDeleteTarget(null)}><div className="modal-content max-w-md text-center" onClick={(event) => event.stopPropagation()}><div className="w-14 h-14 rounded-full bg-error-container text-error flex items-center justify-center mx-auto"><Trash2 size={24} /></div><h3 className="font-black text-primary mt-4">حذف این خبر؟</h3><p className="text-sm text-outline mt-2">«{deleteTarget.title}» برای همیشه حذف می‌شود.</p><div className="flex justify-center gap-3 mt-6"><button onClick={remove} disabled={saving} className="bg-error text-white px-5 py-2.5 rounded-xl text-sm">حذف</button><button onClick={() => setDeleteTarget(null)} className="border border-surface-variant px-5 py-2.5 rounded-xl text-sm text-outline">انصراف</button></div></div></div>}
  </div>;
}
