"use client";

import { useState } from "react";
import { Upload, Link, X } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import toast from "react-hot-toast";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  sizeHint?: string;
  aspectRatio?: string;
}

export default function ImageUpload({ value, onChange, label, sizeHint, aspectRatio }: ImageUploadProps) {
  const [mode, setMode] = useState<"url" | "file">(value && !value.startsWith("blob:") ? "url" : "file");
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${getCookie("token") || ""}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "خطا در آپلود");
      }
      const data = await res.json();
      onChange(data.url);
      toast.success("تصویر با موفقیت آپلود شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-primary mb-1">{label}</label>}
      {sizeHint && <p className="text-xs text-outline mb-2">سایز توصیه شده: {sizeHint}</p>}
      {aspectRatio && <p className="text-xs text-outline mb-2">نسبت تصویر: {aspectRatio}</p>}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === "url" ? "bg-[#03004b] text-white" : "bg-surface-variant text-outline"
          }`}
        >
          <Link size={12} />
          لینک خارجی
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === "file" ? "bg-[#03004b] text-white" : "bg-surface-variant text-outline"
          }`}
        >
          <Upload size={12} />
          آپلود فایل
        </button>
      </div>
      {mode === "url" ? (
        <div className="relative">
          <input
            type="text"
            placeholder="https://example.com/image.jpg"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-[#ffdeab]"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-outline hover:text-error p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-variant text-sm cursor-pointer hover:bg-surface-low transition-colors">
          <Upload size={16} className="text-outline" />
          {uploading ? (
            <span className="text-outline">در حال آپلود...</span>
          ) : (
            <span className="text-outline">انتخاب فایل...</span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      )}
      {value && (
        <div className="mt-2 flex items-center gap-2">
          <img src={value} alt="پیش‌نمایش" className="w-12 h-12 rounded-lg object-cover border border-surface-variant" />
          <span className="text-xs text-outline truncate flex-1">{value}</span>
        </div>
      )}
    </div>
  );
}
