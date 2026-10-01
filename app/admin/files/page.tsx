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
} from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import { Badge, DangerButton, EmptyState, FilterChips, Modal, PageHeader, PrimaryButton, SearchInput, SecondaryButton, StatCard } from "@/components/admin/ui";

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
  { value: "all", label: "فایل‌های عمومی" },
  { value: "image", label: "تصاویر" },
  { value: "video", label: "ویدئو" },
  { value: "audio", label: "صدا" },
  { value: "document", label: "اسناد" },
  { value: "user", label: "فایل‌های کاربران" },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"]);
const allowedExtensions = new Set([
  ...imageExtensions,
  "mp4", "webm", "mov", "mkv", "avi", "mp3", "wav", "ogg", "m4a", "aac",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "7z",
]);

const inputCls = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#03004b] focus:ring-2 focus:ring-[#03004b]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const iconBtnCls = "p-1.5 rounded-lg text-slate-400 transition hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";
const focusCls = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

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
    const isUserFile = file.path.startsWith("users/");
    const matchesFilter = filter === "all" ? !isUserFile : filter === "user" ? isUserFile : file.type === filter;
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
    <div className="space-y-5">
      <PageHeader title="مدیریت فایل‌ها" subtitle="آپلود، جستجو و مدیریت فایل‌های سامانه" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="فضای آزاد سرور" value={storage ? formatBytes(storage.availableBytes) : "—"} sub={`${diskUsagePercent.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪ از دیسک مصرف شده`} icon={HardDrive} tone="bg-slate-100 text-slate-600" />
        <StatCard label="حجم فایل‌های آپلودی" value={storage ? formatBytes(storage.uploadsBytes) : "—"} sub="فقط فایل‌های داخل پوشه uploads" icon={Upload} tone="bg-blue-50 text-blue-600" />
        <StatCard label="تعداد فایل‌ها" value={files.length.toLocaleString("fa-IR")} sub={`${files.filter((file) => file.references.length > 0).length.toLocaleString("fa-IR")} فایل در سایت استفاده شده`} icon={File} tone="bg-emerald-50 text-emerald-600" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr"><div className="h-full rounded-full bg-[#03004b]" style={{ width: `${diskUsagePercent}%` }} /></div>
      </div>

      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!uploading) uploadFiles(event.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-5 transition-colors ${dragging ? "border-[#03004b] bg-slate-50" : "border-slate-300 bg-white"}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600"><Upload size={22} /></div>
            <div><p className="font-bold text-slate-900">فایل‌ها را اینجا رها کنید</p><p className="text-xs text-slate-500 mt-1">تصاویر تا ۱۰ مگابایت؛ ویدئو، صدا، سند و فایل فشرده تا ۵۰ مگابایت</p></div>
          </div>
          <PrimaryButton onClick={() => inputRef.current?.click()} disabled={uploading}>
             {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
             {uploading ? `در حال آپلود ${(activeUploadIndex + 1).toLocaleString("fa-IR")} از ${uploadItems.length.toLocaleString("fa-IR")}` : "انتخاب فایل"}
           </PrimaryButton>
           <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && uploadFiles(event.target.files)} />
         </div>
         {uploadItems.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4">
           <div className="flex items-center justify-between gap-3 mb-2 text-xs">
             <span className="font-bold text-slate-900 tabular-nums">پیشرفت کل: {totalUploadProgress.toLocaleString("fa-IR")}٪</span>
             <span className="text-slate-500 tabular-nums">{formatBytes(loadedUploadBytes)} از {formatBytes(totalUploadBytes)}</span>
           </div>
           <div className="h-2 rounded-full bg-slate-100 overflow-hidden" dir="ltr"><div className="h-full bg-[#03004b] transition-[width] duration-200" style={{ width: `${totalUploadProgress}%` }} /></div>
           <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pl-1">
             {uploadItems.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
               <div className="flex items-center gap-3">
                 <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.status === "success" ? "bg-emerald-50 text-emerald-600" : item.status === "error" ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-600"}`}>
                   {item.status === "uploading" ? <Loader2 size={18} className="animate-spin" /> : item.status === "success" ? <Check size={18} /> : item.status === "error" ? <AlertCircle size={18} /> : <File size={18} />}
                 </div>
                 <div className="min-w-0 flex-1">
                   <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-900 truncate tabular-nums" dir="ltr" title={item.file.name}>{item.file.name}</p><span className="text-xs font-bold text-slate-500 tabular-nums shrink-0">{item.progress.toLocaleString("fa-IR")}٪</span></div>
                   <div className="flex items-center justify-between gap-2 mt-1"><span className={`text-[11px] ${item.status === "error" ? "text-red-600" : "text-slate-500"}`}>{item.error || (item.status === "queued" ? "در صف انتظار" : item.status === "success" ? "آپلود کامل شد" : item.progress === 100 ? "در حال ذخیره روی سرور" : "در حال ارسال")}</span><span className="text-[10px] text-slate-500 tabular-nums shrink-0">{formatBytes(item.loaded)} / {formatBytes(item.file.size)}</span></div>
                   <div className="h-1.5 rounded-full bg-white mt-2 overflow-hidden" dir="ltr"><div className={`h-full transition-[width] duration-200 ${item.status === "error" ? "bg-red-500" : item.status === "success" ? "bg-emerald-500" : "bg-[#03004b]"}`} style={{ width: `${item.progress}%` }} /></div>
                 </div>
               </div>
             </div>)}
           </div>
           {!uploading && <div className="flex justify-end mt-3"><button type="button" onClick={() => setUploadItems([])} className={`text-xs text-slate-500 hover:text-slate-900 rounded ${focusCls}`}>پاک کردن فهرست</button></div>}
         </div>}
       </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <FilterChips options={filters} value={filter} onChange={(value) => setFilter(value)} />
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجوی فایل..." /></div>
            <button type="button" onClick={fetchFiles} className={`p-2.5 rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 ${focusCls}`}><RefreshCw size={18} /></button>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden"><button type="button" onClick={() => setView("grid")} className={`p-2.5 transition ${focusCls} ${view === "grid" ? "bg-[#03004b] text-white" : "bg-white text-slate-500"}`}><Grid2X2 size={18} /></button><button type="button" onClick={() => setView("list")} className={`p-2.5 transition ${focusCls} ${view === "list" ? "bg-[#03004b] text-white" : "bg-white text-slate-500"}`}><List size={18} /></button></div>
          </div>
        </div>

        {loading ? <div className="py-20 flex justify-center"><Loader2 size={34} className="animate-spin text-[#03004b]" /></div> : error ? <div className="py-20 text-center text-red-600"><AlertCircle size={38} className="mx-auto mb-3" /><p>{error}</p></div> : filteredFiles.length === 0 ? <div className="py-10 text-center"><File size={42} className="mx-auto text-slate-300" /><EmptyState message="فایلی پیدا نشد" /></div> : view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
            {filteredFiles.map((file) => <div key={file.path} className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow bg-white">
              <button type="button" onClick={() => setPreview(file)} className={`relative w-full aspect-square bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 ${focusCls}`}>
                {file.type === "image" ? <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <FileTypeIcon type={file.type} size={52} />}
                <span className="absolute top-2 left-2"><Badge tone="slate">{file.extension}</Badge></span>
                {file.references.length > 0 && <span className="absolute top-2 right-2"><Badge tone="emerald"><Check size={10} /> در استفاده</Badge></span>}
              </button>
               <div className="p-3"><p className="text-xs font-bold text-slate-900 truncate tabular-nums" dir="ltr" title={file.name}>{file.name}</p><p className="mt-1 truncate text-[10px] text-slate-500" dir="ltr" title={file.path}>{file.path}</p><p className="text-[11px] tabular-nums text-slate-500 mt-1">{formatBytes(file.size)}</p><div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100"><button type="button" onClick={() => copyUrl(file)} className={iconBtnCls} title="کپی لینک"><Clipboard size={15} /></button><button type="button" onClick={() => openRename(file)} className={iconBtnCls} title="تغییر نام"><Pencil size={15} /></button><a href={file.url} download className={iconBtnCls} title="دانلود"><Download size={15} /></a><button type="button" onClick={() => file.references.length ? toast.error(`این فایل در ${file.references.length.toLocaleString("fa-IR")} بخش استفاده شده است`) : setDeleteTarget(file)} className={`p-1.5 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${file.references.length ? "text-slate-300 cursor-not-allowed" : "text-slate-400 hover:text-red-600"}`} title="حذف"><Trash2 size={15} /></button></div></div>
            </div>)}
          </div>
        ) : (
           <div className="divide-y divide-slate-100">{filteredFiles.map((file) => <div key={file.path} className="p-3 flex items-center gap-4 transition hover:bg-slate-50/60"><button type="button" onClick={() => setPreview(file)} className={`w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 shrink-0 ${focusCls}`}>{file.type === "image" ? <img src={file.url} alt="" className="w-full h-full object-cover" /> : <FileTypeIcon type={file.type} size={24} />}</button><div className="min-w-0 flex-1"><p className="font-bold text-slate-900 text-sm truncate tabular-nums" dir="ltr">{file.name}</p><p className="mt-1 truncate text-[11px] text-slate-500" dir="ltr">{file.path}</p><p className="text-xs tabular-nums text-slate-500 mt-1">{formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleDateString("fa-IR")}</p></div><div className="hidden md:block text-xs tabular-nums text-slate-500 w-32">{file.references.length ? `${file.references.length.toLocaleString("fa-IR")} ارجاع` : "بدون استفاده"}</div><div className="flex gap-1"><button type="button" onClick={() => setPreview(file)} className={`p-2 rounded-lg text-slate-400 transition hover:text-slate-700 ${focusCls}`}><Eye size={17} /></button><button type="button" onClick={() => copyUrl(file)} className={`p-2 rounded-lg text-slate-400 transition hover:text-slate-700 ${focusCls}`}><Clipboard size={17} /></button><button type="button" onClick={() => openRename(file)} className={`p-2 rounded-lg text-slate-400 transition hover:text-slate-700 ${focusCls}`} title="تغییر نام"><Pencil size={17} /></button><button type="button" onClick={() => file.references.length ? toast.error("فایل در سایت استفاده شده است") : setDeleteTarget(file)} className={`p-2 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b] ${file.references.length ? "text-slate-300" : "text-slate-400 hover:text-red-600"}`}><Trash2 size={17} /></button></div></div>)}</div>
        )}
      </div>

      {preview && <Modal title={preview.name} subtitle={formatBytes(preview.size)} onClose={() => setPreview(null)} maxWidth="max-w-4xl">
        <div className="bg-slate-100 rounded-xl min-h-64 max-h-[60vh] overflow-auto flex items-center justify-center">{preview.type === "image" ? <img src={preview.url} alt={preview.name} className="max-w-full max-h-[60vh] object-contain" /> : preview.type === "video" ? <video src={preview.url} controls className="max-w-full max-h-[60vh]" /> : preview.type === "audio" ? <audio src={preview.url} controls className="w-4/5" /> : preview.extension === "PDF" ? <iframe src={preview.url} title={preview.name} className="w-full h-[60vh]" /> : <div className="text-slate-400 text-center"><FileTypeIcon type={preview.type} size={64} /><p className="mt-3">پیش‌نمایش این فرمت در دسترس نیست</p></div>}</div>
        {preview.references.length > 0 && <div className="mt-4 bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm"><p className="font-bold mb-1">محل‌های استفاده:</p>{preview.references.map((reference) => <p key={reference} className="text-xs mt-1">• {reference}</p>)}</div>}
        <div className="flex gap-2 mt-5">
          <PrimaryButton onClick={() => copyUrl(preview)}><Clipboard size={16} /> کپی لینک</PrimaryButton>
          <a href={preview.url} download className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 ${focusCls}`}><Download size={16} /> دانلود</a>
        </div>
      </Modal>}

      {deleteTarget && <Modal title="حذف دائمی فایل" onClose={() => !deleting && setDeleteTarget(null)} maxWidth="max-w-md">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-500"><ShieldAlert size={28} /></div>
          <p className="text-sm font-bold text-slate-900 mt-4 break-all" dir="ltr">{deleteTarget.name}</p>
          <p className="text-xs text-red-600 mt-3">این عملیات قابل بازگشت نیست.</p>
        </div>
        <div className="flex justify-center gap-3 mt-6">
          <DangerButton onClick={deleteFile} disabled={deleting}>{deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} حذف فایل</DangerButton>
          <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={deleting}>انصراف</SecondaryButton>
        </div>
      </Modal>}

      {renameTarget && <Modal title={renameTarget.fromUpload ? "یک نام مناسب برای فایل انتخاب کنید" : "تغییر نام فایل"} subtitle="نام را انگلیسی وارد کنید. پسوند فایل به‌صورت خودکار حفظ می‌شود و تمام لینک‌های قبلی بروزرسانی خواهند شد." onClose={() => { if (!renaming) { if (renameTarget.fromUpload) showNextRename(); else setRenameTarget(null); } }} maxWidth="max-w-md">
        <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><Pencil size={22} /></div>
        <p className="text-xs text-slate-500 mt-4 truncate tabular-nums" dir="ltr">{renameTarget.name}</p>
        <div className="mt-2" dir="ltr"><input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value.replace(/\.[^.]*$/, ""))} onKeyDown={(event) => { if (event.key === "Enter") renameFile(); }} placeholder="example-file-name" className={`w-full ${inputCls}`} /></div>
        <p className="text-[11px] text-slate-500 mt-2" dir="ltr">A-Z, a-z, 0-9, - and _</p>
        <div className="flex gap-2 mt-5">
          <PrimaryButton onClick={renameFile} disabled={renaming}>{renaming ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} ذخیره نام</PrimaryButton>
          <SecondaryButton onClick={() => renameTarget.fromUpload ? showNextRename() : setRenameTarget(null)} disabled={renaming}>{renameTarget.fromUpload ? "فعلاً رد شود" : "انصراف"}</SecondaryButton>
        </div>
        {renameQueue.length > 0 && <p className="text-[11px] tabular-nums text-slate-500 mt-4">پس از این فایل، {renameQueue.length.toLocaleString("fa-IR")} فایل دیگر برای نام‌گذاری باقی مانده است.</p>}
      </Modal>}
    </div>
  );
}
