"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Image as ImageIcon, Link, Loader2, Upload, X } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import toast from "react-hot-toast";
import ImageEditor from "./image-editor";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  sizeHint?: string;
  aspectRatio?: string;
  maxSizeMB?: number;
}

interface LibraryImage { name: string; url: string; size: number; type: string }

function parseAspect(value?: string) {
  if (!value) return 1;
  const [width, height] = value.split(":").map(Number);
  return width > 0 && height > 0 ? width / height : 1;
}

export default function ImageUpload({ value, onChange, label, sizeHint, aspectRatio, maxSizeMB = 10 }: ImageUploadProps) {
  const [mode, setMode] = useState<"url" | "file" | "library">("file");
  const [uploading, setUploading] = useState(false);
  const [editorSource, setEditorSource] = useState("");
  const [objectUrl, setObjectUrl] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  function openEditor(source: string, localObjectUrl = "") {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(localObjectUrl);
    setEditorSource(source);
    setLibraryOpen(false);
  }

  function closeEditor() {
    setEditorSource("");
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl("");
  }

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`حداکثر حجم تصویر ${maxSizeMB.toLocaleString("fa-IR")} مگابایت است`);
      event.target.value = "";
      return;
    }
    const source = URL.createObjectURL(file);
    openEditor(source, source);
    event.target.value = "";
  }

  async function openLibrary() {
    setMode("library");
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const response = await fetch("/api/files", { headers: { authorization: `Bearer ${getCookie("token") || ""}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در دریافت فایل‌ها");
      setLibraryImages((data.files || []).filter((file: LibraryImage) => file.type === "image"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در دریافت فایل‌ها");
      setLibraryOpen(false);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function uploadEditedImage(blob: Blob) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", new File([blob], `edited-${Date.now()}.webp`, { type: "image/webp" }));
    try {
      const response = await fetch("/api/upload", { method: "POST", headers: { authorization: `Bearer ${getCookie("token") || ""}` }, body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "خطا در آپلود");
      onChange(data.url);
      setEditorSource("");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl("");
      toast.success("تصویر ویرایش و ذخیره شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در آپلود تصویر");
      throw error;
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-primary mb-1">{label}</label>}
      {sizeHint && <p className="text-xs text-outline mb-2">سایز توصیه شده: {sizeHint}</p>}
      {aspectRatio && <p className="text-xs text-outline mb-2">نسبت تصویر: {aspectRatio}</p>}
      <p className="text-xs text-outline mb-2">حداکثر حجم تصویر: {maxSizeMB.toLocaleString("fa-IR")} مگابایت</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode("url")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "url" ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}><Link size={12} /> لینک خارجی</button>
        <button type="button" onClick={() => setMode("file")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "file" ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}><Upload size={12} /> آپلود و ویرایش</button>
        <button type="button" onClick={openLibrary} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "library" ? "bg-primary text-white" : "bg-surface-variant text-outline"}`}><FolderOpen size={12} /> انتخاب از فایل‌ها</button>
      </div>
      {mode === "url" ? <div className="relative"><input type="text" placeholder="https://example.com/image.jpg" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-surface-variant px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" />{value && <button type="button" onClick={() => onChange("")} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-error"><X size={14} /></button>}</div> : <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-surface-variant px-3 py-2.5 text-sm transition-colors hover:bg-surface-low"><Upload size={16} className="text-outline" /><span className="text-outline">انتخاب تصویر و باز کردن ادیتور...</span><input type="file" accept="image/*" className="hidden" onChange={handleFileSelection} disabled={uploading} /></label>}
      {value && <div className="mt-2 flex items-center gap-2"><img src={value} alt="پیش‌نمایش" className="h-12 w-12 rounded-lg border border-surface-variant object-cover" /><span className="min-w-0 flex-1 truncate text-xs text-outline">{value}</span></div>}

      {libraryOpen && <div className="fixed inset-0 z-[190] flex items-center justify-center bg-primary/75 p-4 backdrop-blur-sm" onClick={() => setLibraryOpen(false)}><div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-surface-variant p-5"><div><h3 className="font-bold text-primary">انتخاب از مدیریت فایل</h3><p className="mt-1 text-xs text-outline">پس از انتخاب، تصویر در ادیتور باز می‌شود</p></div><button type="button" onClick={() => setLibraryOpen(false)} className="p-2 text-outline"><X size={20} /></button></div>{libraryLoading ? <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" size={30} /></div> : libraryImages.length === 0 ? <div className="py-20 text-center text-outline"><ImageIcon className="mx-auto mb-3" size={40} />تصویری در مدیریت فایل وجود ندارد</div> : <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-5">{libraryImages.map((image) => <button type="button" key={image.url} onClick={() => openEditor(image.url)} className="group overflow-hidden rounded-2xl border border-surface-variant bg-surface-low text-right hover:border-secondary"><img src={image.url} alt={image.name} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" /><p className="truncate p-2 text-xs text-outline" dir="ltr">{image.name}</p></button>)}</div>}</div></div>}
      {editorSource && <ImageEditor source={editorSource} aspect={parseAspect(aspectRatio)} onCancel={closeEditor} onSave={uploadEditedImage} />}
    </div>
  );
}
