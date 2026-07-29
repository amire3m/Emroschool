"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Crop, Loader2, RotateCw, X, ZoomIn } from "lucide-react";

function createImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function rotatedSize(width: number, height: number, rotation: number) {
  const radians = rotation * Math.PI / 180;
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
}

async function renderEditedImage(source: string, crop: Area, rotation: number) {
  const image = await createImage(source);
  const bounds = rotatedSize(image.width, image.height, rotation);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.ceil(bounds.width);
  sourceCanvas.height = Math.ceil(bounds.height);
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) throw new Error("مرورگر امکان پردازش تصویر را ندارد");

  sourceContext.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
  sourceContext.rotate(rotation * Math.PI / 180);
  sourceContext.drawImage(image, -image.width / 2, -image.height / 2);

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(crop.width * scale));
  output.height = Math.max(1, Math.round(crop.height * scale));
  const context = output.getContext("2d");
  if (!context) throw new Error("مرورگر امکان پردازش تصویر را ندارد");
  context.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, output.width, output.height);

  return new Promise<Blob>((resolve, reject) => {
    output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("ساخت تصویر ناموفق بود")), "image/webp", 0.9);
  });
}

export default function ImageEditor({
  source,
  aspect,
  onCancel,
  onSave,
}: {
  source: string;
  aspect: number;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const onCropComplete = useCallback((_area: Area, pixels: Area) => setCroppedArea(pixels), []);

  async function save() {
    if (!croppedArea) return;
    setSaving(true);
    try {
      await onSave(await renderEditedImage(source, croppedArea, rotation));
    } catch {
      // The upload component reports the actionable error and keeps the editor open.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-primary/80 p-3 backdrop-blur-md" dir="rtl">
      <div className="flex h-[min(760px,94vh)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-variant px-5 py-4"><div><h3 className="font-bold text-primary">تنظیم تصویر</h3><p className="mt-1 text-xs text-outline">تصویر را جابه‌جا، زوم یا بچرخانید تا داخل قاب قرار بگیرد</p></div><button type="button" onClick={onCancel} disabled={saving} className="rounded-xl p-2 text-outline hover:bg-surface-low hover:text-primary"><X size={20} /></button></div>
        <div className="relative flex-1 bg-[#11121a]"><Cropper image={source} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={onCropComplete} showGrid /></div>
        <div className="space-y-4 border-t border-surface-variant bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-primary"><ZoomIn size={18} className="text-secondary" /><span className="w-10">زوم</span><input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1 accent-[#7b5814]" /></label>
            <label className="flex items-center gap-3 text-sm text-primary"><RotateCw size={18} className="text-secondary" /><span className="w-10">چرخش</span><input type="range" min={-180} max={180} step={1} value={rotation} onChange={(event) => setRotation(Number(event.target.value))} className="flex-1 accent-[#7b5814]" /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setRotation((value) => value + 90)} className="flex items-center gap-2 rounded-xl border border-surface-variant px-4 py-2 text-sm text-primary hover:bg-surface-low"><RotateCw size={16} /> چرخش ۹۰ درجه</button><div className="flex gap-2"><button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-surface-variant px-5 py-2.5 text-sm text-outline">انصراف</button><button type="button" onClick={save} disabled={saving || !croppedArea} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={17} className="animate-spin" /> : <Crop size={17} />} اعمال و ذخیره</button></div></div>
        </div>
      </div>
    </div>
  );
}
