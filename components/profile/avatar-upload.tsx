"use client";

import { useState } from "react";
import { ImagePlus, Loader2, User } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";
import ImageEditor from "@/components/ui/image-editor";

export default function AvatarUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [source, setSource] = useState("");
  const [uploading, setUploading] = useState(false);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("حداکثر حجم تصویر ۱۰ مگابایت است"); return; }
    setSource(URL.createObjectURL(file));
    event.target.value = "";
  }

  async function save(blob: Blob) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
      const response = await fetch("/api/user/avatar", { method: "POST", headers: { authorization: `Bearer ${getCookie("token") || ""}` }, body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در آپلود آواتار");
      onChange(`${data.url}?v=${Date.now()}`);
      setSource("");
      toast.success("آواتار با موفقیت ذخیره شد");
    } catch (error) { toast.error(error instanceof Error ? error.message : "خطا در آپلود آواتار"); throw error; }
    finally { setUploading(false); }
  }

  return <div className="flex items-center gap-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-secondary-fixed bg-surface-variant">{value ? <img src={value} alt="آواتار" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><User size={30} className="text-outline-variant" /></div>}</div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-container"><ImagePlus size={16} />انتخاب و ویرایش تصویر<input type="file" accept="image/*" onChange={chooseFile} className="hidden" disabled={uploading} /></label>{uploading && <Loader2 size={18} className="animate-spin text-secondary" />}{source && <ImageEditor source={source} aspect={1} onCancel={() => setSource("")} onSave={save} />}</div>;
}
