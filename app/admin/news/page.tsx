"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Eye, Loader2, Newspaper, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ImageUpload from "@/components/ui/ImageUpload";
import { getCookie } from "@/lib/cookie";
import { Badge, DangerButton, EmptyState, Modal, PageHeader, PrimaryButton, SearchInput, SecondaryButton } from "@/components/admin/ui";

interface NewsPost { id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string | null; category: string; authorName: string | null; tags: string | null; featured: boolean; published: boolean; publishedAt: string | null; createdAt: string; }
const categories = [{ value: "general", label: "خبر آکادمی" }, { value: "course", label: "دوره‌ها" }, { value: "instructor", label: "اساتید" }, { value: "alumni", label: "هنرآموختگان" }];
const emptyForm = { title: "", slug: "", excerpt: "", content: "", coverImage: "", category: "general", authorName: "", tags: "", featured: false, published: false };

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "p-2 text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] rounded-lg";

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
    <PageHeader
      title="اخبار"
      subtitle="مدیریت اخبار و اطلاعیه‌های سایت"
      actions={<PrimaryButton onClick={openCreate}><Plus size={18} />خبر جدید</PrimaryButton>}
    />
    <div className="flex flex-col sm:flex-row gap-3 justify-between">
      <div className="relative sm:w-72">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو در اخبار..." />
      </div>
    </div>
    {loading ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#03004b]" size={32} /></div> : filtered.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white py-10 text-center"><Newspaper size={42} className="mx-auto mb-1 text-slate-300" /><EmptyState message="خبری پیدا نشد" /></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((post) => <article key={post.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden group">
      <div className="aspect-[16/8] bg-slate-100 relative overflow-hidden">
        {post.coverImage ? <img src={post.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Newspaper size={42} /></div>}
        <div className="absolute top-3 right-3 flex gap-2">
          {post.featured && <span className="rounded-full border border-amber-200/70 bg-amber-50 text-amber-600 p-1.5"><Star size={13} className="fill-current" /></span>}
          <Badge tone={post.published ? "emerald" : "slate"}>{post.published ? "منتشرشده" : "پیش‌نویس"}</Badge>
        </div>
      </div>
      <div className="p-4">
        <span className="text-[11px] font-bold text-slate-500">{categories.find((item) => item.value === post.category)?.label}</span>
        <h2 className="text-base font-black text-slate-900 mt-1 line-clamp-2 leading-7">{post.title}</h2>
        <p className="text-xs text-slate-500 line-clamp-2 leading-6 mt-1">{post.excerpt}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="text-[10px] tabular-nums text-slate-500 flex items-center gap-1"><CalendarDays size={12} />{new Date(post.publishedAt || post.createdAt).toLocaleDateString("fa-IR")}</span>
          <div className="flex gap-1">
            {post.published && <Link href={`/news/${post.slug}`} target="_blank" className={iconBtnCls}><Eye size={16} /></Link>}
            <button type="button" onClick={() => openEdit(post)} className={iconBtnCls}><Pencil size={16} /></button>
            <button type="button" onClick={() => setDeleteTarget(post)} className="rounded-lg p-2 text-slate-400 transition hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]"><Trash2 size={16} /></button>
          </div>
        </div>
      </div>
    </article>)}</div>}

    {modalOpen && <Modal title={editing ? "ویرایش خبر" : "روایت تازه"} subtitle="متن را با یک خط خالی بین پاراگراف‌ها بنویسید." onClose={() => !saving && setModalOpen(false)} maxWidth="max-w-4xl">
      <form onSubmit={save}>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="md:col-span-2 text-sm font-bold text-slate-900">عنوان<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: editing ? current.slug : toSlug(event.target.value) }))} className={`mt-1 w-full font-normal ${inputCls}`} /></label>
          <label className="text-sm font-bold text-slate-900">آدرس صفحه در مجله<div className="mt-1 space-y-1.5" dir="ltr"><div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-normal text-slate-500">mag.imamruhollahschool.com/news/</div><input required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} className={`w-full font-normal ${inputCls}`} /></div></label>
          <label className="text-sm font-bold text-slate-900">موضوع<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={`mt-1 w-full font-normal ${inputCls}`}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="md:col-span-2 text-sm font-bold text-slate-900">خلاصه<input required value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} maxLength={300} className={`mt-1 w-full font-normal ${inputCls}`} /></label>
          <label className="md:col-span-2 text-sm font-bold text-slate-900">متن خبر<textarea required rows={11} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className={`mt-1 w-full font-normal leading-8 resize-y ${inputCls}`} /></label>
          <div className="md:col-span-2"><ImageUpload value={form.coverImage} onChange={(coverImage) => setForm((current) => ({ ...current, coverImage }))} label="تصویر شاخص" sizeHint="پیشنهاد: تصویر افقی با نسبت 16:9" aspectRatio="16:9" /></div>
          <label className="text-sm font-bold text-slate-900">نام نویسنده<input value={form.authorName} onChange={(event) => setForm((current) => ({ ...current, authorName: event.target.value }))} placeholder="تحریریه آکادمی" className={`mt-1 w-full font-normal ${inputCls}`} /></label>
          <label className="text-sm font-bold text-slate-900">برچسب‌ها<input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="هنر، رسانه، آموزش" className={`mt-1 w-full font-normal ${inputCls}`} /></label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-3"><span className="text-sm font-bold text-slate-900">روایت ویژه</span><input type="checkbox" checked={form.featured} onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))} className="w-5 h-5 accent-[#03004b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]" /></label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-3"><span className="text-sm font-bold text-slate-900">انتشار عمومی</span><input type="checkbox" checked={form.published} onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))} className="w-5 h-5 accent-[#03004b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]" /></label>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#03004b] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#1b1c5e] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]">{saving && <Loader2 size={16} className="animate-spin" />}{editing ? "ذخیره تغییرات" : "ایجاد خبر"}</button>
          <SecondaryButton onClick={() => setModalOpen(false)} disabled={saving}>انصراف</SecondaryButton>
        </div>
      </form>
    </Modal>}
    {deleteTarget && <Modal title="حذف این خبر؟" onClose={() => !saving && setDeleteTarget(null)} maxWidth="max-w-md">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto"><Trash2 size={24} /></div>
        <p className="text-sm text-slate-500 mt-4">«{deleteTarget.title}» برای همیشه حذف می‌شود.</p>
      </div>
      <div className="flex justify-center gap-3 mt-6">
        <DangerButton onClick={remove} disabled={saving}>حذف</DangerButton>
        <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={saving}>انصراف</SecondaryButton>
      </div>
    </Modal>}
  </div>;
}
