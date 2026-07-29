"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  Download,
  Eye,
  File,
  FileAudio,
  FileText,
  FileVideo,
  Grid2X2,
  HardDrive,
  Image as ImageIcon,
  List,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

interface ManagedFile {
  name: string;
  path: string;
  url: string;
  size: number;
  modifiedAt: string;
  type: "image" | "video" | "audio" | "document" | "other";
  extension: string;
  references: string[];
}

interface StorageInfo {
  uploadsBytes: number;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
}

interface UploadItem {
  id: string;
  file: File;
  loaded: number;
  progress: number;
  status: "queued" | "uploading" | "success" | "error";
  error?: string;
}

interface RenameTarget {
  path: string;
  name: string;
  suggestedName: string;
  fromUpload?: boolean;
}

const filters = [
  { value: "all", label: "همه فایل‌ها" },
  { value: "image", label: "تصاویر" },
  { value: "video", label: "ویدئو" },
  { value: "audio", label: "صدا" },
  { value: "document", label: "اسناد" },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"]);
const allowedExtensions = new Set([
  ...imageExtensions,
  "mp4", "webm", "mov", "mkv", "avi", "mp3", "wav", "ogg", "m4a", "aac",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "7z",
]);

function validateUpload(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!allowedExtensions.has(extension)) return "فرمت این فایل مجاز نیست";
  if (imageExtensions.has(extension) && file.size > MAX_IMAGE_SIZE) return "حداکثر حجم هر تصویر ۱۰ مگابایت است";
  if (file.size > MAX_FILE_SIZE) return "حداکثر حجم هر فایل ۵۰ مگابایت است";
  return "";
}

function uploadHttpError(status: number, serverMessage: string | undefined, filename: string) {
  if (serverMessage) return serverMessage;
  if (status === 401) return "نشست شما منقضی شده است؛ دوباره وارد شوید";
  if (status === 403) return "اجازه آپلود فایل را ندارید";
  if (status === 413) return "حجم فایل از محدودیت سرور بیشتر است";
  if (status === 502 || status === 504) return "سرور هنگام دریافت فایل پاسخ نداد؛ دوباره تلاش کنید";
  return `آپلود ${filename} ناموفق بود (خطای ${status.toLocaleString("fa-IR")})`;
}

function fileBaseName(filename: string) {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

function englishFileName(filename: string) {
  return fileBaseName(filename).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function formatBytes(bytes: number) {
  if (!bytes) return "۰ بایت";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toLocaleString("fa-IR", { maximumFractionDigits: index > 1 ? 2 : 0 })} ${units[index]}`;
}

function FileTypeIcon({ type, size = 28 }: { type: ManagedFile["type"]; size?: number }) {
  if (type === "image") return <ImageIcon size={size} />;
  if (type === "video") return <FileVideo size={size} />;
  if (type === "audio") return <FileAudio size={size} />;
  if (type === "document") return <FileText size={size} />;
  return <File size={size} />;
}

export default function AdminFilesPage() {
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ManagedFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameQueue, setRenameQueue] = useState<RenameTarget[]>([]);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const token = () => getCookie("token") || "";

  async function fetchFiles() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/files", { headers: { authorization: `Bearer ${token()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در دریافت فایل‌ها");
      setFiles(data.files || []);
      setStorage(data.storage || null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "خطا در دریافت فایل‌ها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchFiles(); }, []);

  async function uploadFiles(selectedFiles: FileList | File[]) {
    const items = Array.from(selectedFiles);
    if (items.length === 0 || uploading) return;
    const queue: UploadItem[] = items.map((file, index) => {
      const validationError = validateUpload(file);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        loaded: 0,
        progress: 0,
        status: validationError ? "error" : "queued",
        error: validationError || undefined,
      };
    });
    const validQueue = queue.filter((item) => item.status === "queued");
    setUploadItems(queue);
    if (validQueue.length === 0) {
      toast.error("هیچ‌کدام از فایل‌های انتخاب‌شده قابل آپلود نیستند");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    let uploaded = 0;
    const uploadedRenameTargets: RenameTarget[] = [];

    for (const queueItem of validQueue) {
      const item = queueItem.file;
      setUploadItems((current) => current.map((entry) => entry.id === queueItem.id ? { ...entry, status: "uploading" } : entry));
      const formData = new FormData();
      formData.append("file", item);
      try {
        const uploadedUrl = await new Promise<string>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/upload");
          request.setRequestHeader("authorization", `Bearer ${token()}`);
          request.upload.addEventListener("progress", (event) => {
            if (!event.lengthComputable) return;
            setUploadItems((current) => current.map((entry) => entry.id === queueItem.id ? {
              ...entry,
              loaded: Math.min(event.loaded, item.size),
              progress: Math.min(100, Math.round((event.loaded / event.total) * 100)),
            } : entry));
          });
          request.addEventListener("load", () => {
            const data = (() => { try { return JSON.parse(request.responseText); } catch { return null; } })();
            if (request.status >= 200 && request.status < 300) resolve(data?.url || "");
            else reject(new Error(uploadHttpError(request.status, data?.error, item.name)));
          });
          request.addEventListener("error", () => reject(new Error(`ارتباط هنگام آپلود ${item.name} قطع شد`)));
          request.addEventListener("abort", () => reject(new Error(`آپلود ${item.name} لغو شد`)));
          request.send(formData);
        });
        const uploadedPath = uploadedUrl.startsWith("/uploads/") ? uploadedUrl.slice("/uploads/".length) : "";
        if (uploadedPath) {
          uploadedRenameTargets.push({
            path: uploadedPath,
            name: uploadedPath.split("/").pop() || item.name,
            suggestedName: englishFileName(item.name),
            fromUpload: true,
          });
        }
        setUploadItems((current) => current.map((entry) => entry.id === queueItem.id ? { ...entry, loaded: item.size, progress: 100, status: "success" } : entry));
        uploaded += 1;
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "خطا در آپلود";
        setUploadItems((current) => current.map((entry) => entry.id === queueItem.id ? { ...entry, status: "error", error: message } : entry));
        toast.error(message);
      }
    }

    setUploading(false);
    if (uploaded > 0) toast.success(`${uploaded.toLocaleString("fa-IR")} فایل آپلود شد`);
    if (inputRef.current) inputRef.current.value = "";
    await fetchFiles();
    if (uploadedRenameTargets.length > 0) {
      const [firstTarget, ...remainingTargets] = uploadedRenameTargets;
      setRenameQueue(remainingTargets);
      setRenameTarget(firstTarget);
      setRenameName(firstTarget.suggestedName);
    }
  }

  function openRename(file: ManagedFile) {
    const target = { path: file.path, name: file.name, suggestedName: fileBaseName(file.name) };
    setRenameQueue([]);
    setRenameTarget(target);
    setRenameName(target.suggestedName);
  }

  function showNextRename() {
    const [nextTarget, ...remainingTargets] = renameQueue;
    setRenameTarget(nextTarget || null);
    setRenameName(nextTarget?.suggestedName || "");
    setRenameQueue(remainingTargets);
  }

  async function renameFile() {
    if (!renameTarget) return;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/.test(renameName.trim())) {
      toast.error("نام باید ۲ تا ۸۰ نویسه و فقط شامل حروف انگلیسی، عدد، خط تیره یا زیرخط باشد");
      return;
    }
    setRenaming(true);
    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token()}` },
        body: JSON.stringify({ path: renameTarget.path, name: renameName.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "خطا در تغییر نام فایل");
      toast.success("نام فایل و لینک‌های استفاده‌شده بروزرسانی شد");
      await fetchFiles();
      showNextRename();
    } catch (renameError) {
      toast.error(renameError instanceof Error ? renameError.message : "خطا در تغییر نام فایل");
    } finally {
      setRenaming(false);
    }
  }

  async function copyUrl(file: ManagedFile) {
    await navigator.clipboard.writeText(`${window.location.origin}${file.url}`);
    toast.success("لینک فایل کپی شد");
  }

  async function deleteFile() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token()}` },
        body: JSON.stringify({ path: deleteTarget.path }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "خطا در حذف فایل");
      toast.success("فایل حذف شد");
      setDeleteTarget(null);
      await fetchFiles();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "خطا در حذف فایل");
    } finally {
      setDeleting(false);
    }
  }

  const filteredFiles = files.filter((file) => {
    const matchesFilter = filter === "all" || file.type === filter;
    const normalizedSearch = search.trim().toLowerCase();
    return matchesFilter && (!normalizedSearch || file.name.toLowerCase().includes(normalizedSearch) || file.extension.toLowerCase().includes(normalizedSearch));
  });
  const diskUsagePercent = storage?.totalBytes ? Math.min(100, (storage.usedBytes / storage.totalBytes) * 100) : 0;
  const measurableUploadItems = uploadItems.filter((item) => item.status !== "error");
  const totalUploadBytes = measurableUploadItems.reduce((sum, item) => sum + item.file.size, 0);
  const loadedUploadBytes = measurableUploadItems.reduce((sum, item) => sum + item.loaded, 0);
  const totalUploadProgress = totalUploadBytes ? Math.round((loadedUploadBytes / totalUploadBytes) * 100) : 0;
  const activeUploadIndex = uploadItems.findIndex((item) => item.status === "uploading");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary text-white rounded-2xl p-5 relative overflow-hidden">
          <HardDrive className="absolute -left-4 -bottom-4 text-white/10" size={100} />
          <p className="text-white/60 text-sm">فضای آزاد سرور</p>
          <p className="text-2xl font-black mt-2">{storage ? formatBytes(storage.availableBytes) : "—"}</p>
          <div className="h-1.5 bg-white/15 rounded-full mt-4 overflow-hidden"><div className="h-full bg-secondary-fixed rounded-full" style={{ width: `${diskUsagePercent}%` }} /></div>
          <p className="text-xs text-white/50 mt-2">{diskUsagePercent.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪ از دیسک مصرف شده</p>
        </div>
        <div className="bg-white rounded-2xl border border-surface-variant p-5">
          <p className="text-outline text-sm">حجم فایل‌های آپلودی</p>
          <p className="text-2xl font-black text-primary mt-2">{storage ? formatBytes(storage.uploadsBytes) : "—"}</p>
          <p className="text-xs text-outline mt-4">فقط فایل‌های داخل پوشه uploads</p>
        </div>
        <div className="bg-white rounded-2xl border border-surface-variant p-5">
          <p className="text-outline text-sm">تعداد فایل‌ها</p>
          <p className="text-2xl font-black text-secondary mt-2">{files.length.toLocaleString("fa-IR")}</p>
          <p className="text-xs text-outline mt-4">{files.filter((file) => file.references.length > 0).length.toLocaleString("fa-IR")} فایل در سایت استفاده شده</p>
        </div>
      </div>

      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!uploading) uploadFiles(event.dataTransfer.files); }}
        className={`rounded-2xl border-2 border-dashed p-5 transition-colors ${dragging ? "border-secondary bg-secondary-fixed/20" : "border-outline-variant bg-white"}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary"><Upload size={22} /></div>
            <div><p className="font-bold text-primary">فایل‌ها را اینجا رها کنید</p><p className="text-xs text-outline mt-1">تصاویر تا ۱۰ مگابایت؛ ویدئو، صدا، سند و فایل فشرده تا ۵۰ مگابایت</p></div>
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
             {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
             {uploading ? `در حال آپلود ${(activeUploadIndex + 1).toLocaleString("fa-IR")} از ${uploadItems.length.toLocaleString("fa-IR")}` : "انتخاب فایل"}
           </button>
           <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && uploadFiles(event.target.files)} />
         </div>
         {uploadItems.length > 0 && <div className="mt-5 border-t border-surface-variant pt-4">
           <div className="flex items-center justify-between gap-3 mb-2 text-xs">
             <span className="font-bold text-primary">پیشرفت کل: {totalUploadProgress.toLocaleString("fa-IR")}٪</span>
             <span className="text-outline">{formatBytes(loadedUploadBytes)} از {formatBytes(totalUploadBytes)}</span>
           </div>
           <div className="h-2 rounded-full bg-surface-low overflow-hidden" dir="ltr"><div className="h-full bg-secondary transition-[width] duration-200" style={{ width: `${totalUploadProgress}%` }} /></div>
           <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pl-1">
             {uploadItems.map((item) => <div key={item.id} className="rounded-xl border border-surface-variant bg-surface-low/40 p-3">
               <div className="flex items-center gap-3">
                 <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.status === "success" ? "bg-green-100 text-green-700" : item.status === "error" ? "bg-error-container text-error" : "bg-secondary-fixed text-secondary"}`}>
                   {item.status === "uploading" ? <Loader2 size={18} className="animate-spin" /> : item.status === "success" ? <Check size={18} /> : item.status === "error" ? <AlertCircle size={18} /> : <File size={18} />}
                 </div>
                 <div className="min-w-0 flex-1">
                   <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-primary truncate" dir="ltr" title={item.file.name}>{item.file.name}</p><span className="text-xs font-bold text-outline shrink-0">{item.progress.toLocaleString("fa-IR")}٪</span></div>
                   <div className="flex items-center justify-between gap-2 mt-1"><span className={`text-[11px] ${item.status === "error" ? "text-error" : "text-outline"}`}>{item.error || (item.status === "queued" ? "در صف انتظار" : item.status === "success" ? "آپلود کامل شد" : item.progress === 100 ? "در حال ذخیره روی سرور" : "در حال ارسال")}</span><span className="text-[10px] text-outline shrink-0">{formatBytes(item.loaded)} / {formatBytes(item.file.size)}</span></div>
                   <div className="h-1.5 rounded-full bg-white mt-2 overflow-hidden" dir="ltr"><div className={`h-full transition-[width] duration-200 ${item.status === "error" ? "bg-error" : item.status === "success" ? "bg-green-600" : "bg-secondary"}`} style={{ width: `${item.progress}%` }} /></div>
                 </div>
               </div>
             </div>)}
           </div>
           {!uploading && <div className="flex justify-end mt-3"><button type="button" onClick={() => setUploadItems([])} className="text-xs text-outline hover:text-primary">پاک کردن فهرست</button></div>}
         </div>}
       </div>

      <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-variant flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filter === item.value ? "bg-primary text-white" : "bg-surface-low text-outline hover:text-primary"}`}>{item.label}</button>)}</div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجوی فایل..." className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" /></div>
            <button onClick={fetchFiles} className="p-2.5 rounded-xl border border-surface-variant text-outline hover:text-primary"><RefreshCw size={18} /></button>
            <div className="flex rounded-xl border border-surface-variant overflow-hidden"><button onClick={() => setView("grid")} className={`p-2.5 ${view === "grid" ? "bg-primary text-white" : "text-outline"}`}><Grid2X2 size={18} /></button><button onClick={() => setView("list")} className={`p-2.5 ${view === "list" ? "bg-primary text-white" : "text-outline"}`}><List size={18} /></button></div>
          </div>
        </div>

        {loading ? <div className="py-20 flex justify-center"><Loader2 size={34} className="animate-spin text-primary" /></div> : error ? <div className="py-20 text-center text-error"><AlertCircle size={38} className="mx-auto mb-3" /><p>{error}</p></div> : filteredFiles.length === 0 ? <div className="py-20 text-center"><File size={42} className="mx-auto text-outline-variant mb-3" /><p className="text-outline">فایلی پیدا نشد</p></div> : view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
            {filteredFiles.map((file) => <div key={file.path} className="group rounded-2xl border border-surface-variant overflow-hidden hover:shadow-md transition-shadow bg-white">
              <button onClick={() => setPreview(file)} className="relative w-full aspect-square bg-surface-low overflow-hidden flex items-center justify-center text-outline">
                {file.type === "image" ? <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <FileTypeIcon type={file.type} size={52} />}
                <span className="absolute top-2 left-2 text-[10px] bg-primary/80 text-white px-2 py-1 rounded-lg">{file.extension}</span>
                {file.references.length > 0 && <span className="absolute top-2 right-2 text-[10px] bg-green-600 text-white px-2 py-1 rounded-lg flex items-center gap-1"><Check size={10} /> در استفاده</span>}
              </button>
              <div className="p-3"><p className="text-xs font-bold text-primary truncate" dir="ltr" title={file.name}>{file.name}</p><p className="text-[11px] text-outline mt-1">{formatBytes(file.size)}</p><div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-variant/60"><button onClick={() => copyUrl(file)} className="p-1.5 text-outline hover:text-primary" title="کپی لینک"><Clipboard size={15} /></button><button onClick={() => openRename(file)} className="p-1.5 text-outline hover:text-primary" title="تغییر نام"><Pencil size={15} /></button><a href={file.url} download className="p-1.5 text-outline hover:text-primary" title="دانلود"><Download size={15} /></a><button onClick={() => file.references.length ? toast.error(`این فایل در ${file.references.length.toLocaleString("fa-IR")} بخش استفاده شده است`) : setDeleteTarget(file)} className={`p-1.5 ${file.references.length ? "text-outline-variant cursor-not-allowed" : "text-outline hover:text-error"}`} title="حذف"><Trash2 size={15} /></button></div></div>
            </div>)}
          </div>
        ) : (
          <div className="divide-y divide-surface-variant">{filteredFiles.map((file) => <div key={file.path} className="p-3 flex items-center gap-4 hover:bg-surface-low/60"><button onClick={() => setPreview(file)} className="w-12 h-12 rounded-xl bg-surface-low overflow-hidden flex items-center justify-center text-outline shrink-0">{file.type === "image" ? <img src={file.url} alt="" className="w-full h-full object-cover" /> : <FileTypeIcon type={file.type} size={24} />}</button><div className="min-w-0 flex-1"><p className="font-bold text-primary text-sm truncate" dir="ltr">{file.name}</p><p className="text-xs text-outline mt-1">{formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleDateString("fa-IR")}</p></div><div className="hidden md:block text-xs text-outline w-32">{file.references.length ? `${file.references.length.toLocaleString("fa-IR")} ارجاع` : "بدون استفاده"}</div><div className="flex gap-1"><button onClick={() => setPreview(file)} className="p-2 text-outline hover:text-primary"><Eye size={17} /></button><button onClick={() => copyUrl(file)} className="p-2 text-outline hover:text-primary"><Clipboard size={17} /></button><button onClick={() => openRename(file)} className="p-2 text-outline hover:text-primary" title="تغییر نام"><Pencil size={17} /></button><button onClick={() => file.references.length ? toast.error("فایل در سایت استفاده شده است") : setDeleteTarget(file)} className={`p-2 ${file.references.length ? "text-outline-variant" : "text-outline hover:text-error"}`}><Trash2 size={17} /></button></div></div>)}</div>
        )}
      </div>

      {preview && <div className="modal-overlay" onClick={() => setPreview(null)}><div className="modal-content max-w-4xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between mb-4"><div className="min-w-0"><h3 className="font-bold text-primary truncate" dir="ltr">{preview.name}</h3><p className="text-xs text-outline mt-1">{formatBytes(preview.size)}</p></div><button onClick={() => setPreview(null)} className="p-2 text-outline hover:text-primary"><X size={20} /></button></div><div className="bg-surface-low rounded-2xl min-h-64 max-h-[60vh] overflow-auto flex items-center justify-center">{preview.type === "image" ? <img src={preview.url} alt={preview.name} className="max-w-full max-h-[60vh] object-contain" /> : preview.type === "video" ? <video src={preview.url} controls className="max-w-full max-h-[60vh]" /> : preview.type === "audio" ? <audio src={preview.url} controls className="w-4/5" /> : preview.extension === "PDF" ? <iframe src={preview.url} title={preview.name} className="w-full h-[60vh]" /> : <div className="text-outline text-center"><FileTypeIcon type={preview.type} size={64} /><p className="mt-3">پیش‌نمایش این فرمت در دسترس نیست</p></div>}</div>{preview.references.length > 0 && <div className="mt-4 bg-green-50 text-green-800 rounded-xl p-3 text-sm"><p className="font-bold mb-1">محل‌های استفاده:</p>{preview.references.map((reference) => <p key={reference} className="text-xs mt-1">• {reference}</p>)}</div>}<div className="flex gap-2 mt-4"><button onClick={() => copyUrl(preview)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm"><Clipboard size={16} /> کپی لینک</button><a href={preview.url} download className="flex items-center gap-2 border border-surface-variant px-4 py-2 rounded-xl text-sm text-primary"><Download size={16} /> دانلود</a></div></div></div>}

      {deleteTarget && <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}><div className="modal-content max-w-md" onClick={(event) => event.stopPropagation()}><div className="text-center"><div className="w-16 h-16 mx-auto rounded-full bg-error-container flex items-center justify-center text-error"><ShieldAlert size={28} /></div><h3 className="text-lg font-bold text-primary mt-4">حذف دائمی فایل</h3><p className="text-sm text-outline mt-2 break-all" dir="ltr">{deleteTarget.name}</p><p className="text-xs text-error mt-3">این عملیات قابل بازگشت نیست.</p><div className="flex justify-center gap-3 mt-6"><button onClick={deleteFile} disabled={deleting} className="flex items-center gap-2 bg-error text-white px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">{deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} حذف فایل</button><button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-5 py-2.5 rounded-xl border border-surface-variant text-sm text-outline">انصراف</button></div></div></div></div>}

      {renameTarget && <div className="modal-overlay"><div className="modal-content max-w-md" onClick={(event) => event.stopPropagation()}><div className="w-12 h-12 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center"><Pencil size={22} /></div><h3 className="text-lg font-bold text-primary mt-4">{renameTarget.fromUpload ? "یک نام مناسب برای فایل انتخاب کنید" : "تغییر نام فایل"}</h3><p className="text-xs text-outline mt-2">نام را انگلیسی وارد کنید. پسوند فایل به‌صورت خودکار حفظ می‌شود و تمام لینک‌های قبلی بروزرسانی خواهند شد.</p><p className="text-xs text-outline mt-4 truncate" dir="ltr">{renameTarget.name}</p><div className="mt-2" dir="ltr"><input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value.replace(/\.[^.]*$/, ""))} onKeyDown={(event) => { if (event.key === "Enter") renameFile(); }} placeholder="example-file-name" className="w-full px-4 py-3 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-secondary-fixed" /></div><p className="text-[11px] text-outline mt-2" dir="ltr">A-Z, a-z, 0-9, - and _</p><div className="flex gap-2 mt-5"><button onClick={renameFile} disabled={renaming} className="flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">{renaming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} ذخیره نام</button><button onClick={() => renameTarget.fromUpload ? showNextRename() : setRenameTarget(null)} disabled={renaming} className="px-5 py-2.5 rounded-xl border border-surface-variant text-sm text-outline">{renameTarget.fromUpload ? "فعلاً رد شود" : "انصراف"}</button></div>{renameQueue.length > 0 && <p className="text-[11px] text-outline mt-4">پس از این فایل، {renameQueue.length.toLocaleString("fa-IR")} فایل دیگر برای نام‌گذاری باقی مانده است.</p>}</div></div>}
    </div>
  );
}
