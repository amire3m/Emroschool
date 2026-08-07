"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

const mapUrl = "https://www.google.com/maps?q=35.699257969493395,51.39662703655142&z=16&output=embed";

export default function DeferredMap({ title, className }: { title: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  return loaded ? <iframe title={title} src={mapUrl} referrerPolicy="no-referrer-when-downgrade" className={className} /> : <button type="button" onClick={() => setLoaded(true)} className={`${className} flex flex-col items-center justify-center gap-3 bg-primary/5 text-primary`}><MapPin size={28} className="text-secondary" /><span className="text-sm font-bold">برای نمایش نقشه کلیک کنید</span><span className="text-xs text-outline">بارگذاری نقشه فقط در صورت نیاز</span></button>;
}
