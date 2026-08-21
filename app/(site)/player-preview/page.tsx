"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import VideoPlayer from "@/components/courses/video-player";

const DEFAULT_SRC = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

function Preview() {
  const params = useSearchParams();
  const initial = params.get("src") || DEFAULT_SRC;
  const [src, setSrc] = useState(initial);

  return (
    <main className="min-h-screen bg-primary px-4 py-24">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-center text-xl font-black text-secondary-fixed">پیشنمایش پلیر اختصاصی</h1>
        <p className="mt-2 text-center text-sm text-white/60">
          پلیر را با لینک دلخواه خود (MP4 یا m3u8) تست کنید.
        </p>

        <div className="mt-6 flex gap-2">
          <input
            dir="ltr"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder="لینک مستقیم ویدیو (mp4 یا m3u8)"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-secondary-fixed"
          />
          <button
            onClick={() => setSrc((current) => current)}
            className="shrink-0 rounded-xl bg-secondary-fixed px-4 py-2.5 text-sm font-bold text-primary"
          >
            اعمال
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-black shadow-2xl">
          <VideoPlayer key={src} src={src} className="aspect-video" />
        </div>

        <p className="mt-4 text-center text-xs text-white/50" dir="rtl">
          نکته: کنترل‌ها بعد از چند ثانیه مخفی می‌شوند؛ با حرکت ماوس/لمس ظاهر می‌شوند. میانبرهای کیبورد: فاصله (پخش/مکث)،
          ←/→ (عقب/جلو)، ↑/↓ (صدا)، M (بی‌صدا)، F (تمام‌صفحه).
        </p>
      </div>
    </main>
  );
}

export default function PlayerPreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}