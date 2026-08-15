import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: `دانلود اپلیکیشن اندروید | ${siteName}`,
  description: "دانلود اپلیکیشن اندروید آکادمی هنر و رسانه امام روح‌الله (ره) با امکان دریافت اعلان و دسترسی سریع.",
  alternates: { canonical: "/download" },
};

export const dynamic = "force-dynamic";

function findApk(): { name: string; version: string } | null {
  const directory = path.join(process.cwd(), "public", "apk");
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return null;
  }
  const apks = entries.filter((entry) => entry.toLowerCase().endsWith(".apk"));
  if (apks.length === 0) return null;
  const apk = apks.sort().at(-1)!;
  const version = (apk.match(/(\d+\.\d+\.\d+)/) || [])[1] || "";
  return { name: apk, version };
}

export default function DownloadPage() {
  const apk = findApk();
  return (
    <main className="min-h-screen bg-surface pb-20 pt-28">
      <div className="mx-auto max-w-2xl px-5 md:px-8">
        <div className="rounded-[2rem] border border-outline-variant/40 bg-white p-7 text-center shadow-sm md:p-12">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512x512.png" alt="آیکن اپلیکیشن" className="h-full w-full object-cover" />
          </div>
          <p className="mt-8 text-sm font-bold tracking-[.18em] text-secondary">اپلیکیشن اندروید</p>
          <h1 className="mt-4 text-3xl font-black text-primary md:text-4xl">دانلود اپلیکیشن</h1>
          <p className="mt-3 text-sm leading-7 text-outline">
            نسخه اندروید آکادمی هنر و رسانه امام روح‌الله (ره) را نصب کنید و از امکانات اعلان، دسترسی سریع و تجربه بهتر بهره‌مند شوید.
          </p>
          {apk ? (
            <div className="mt-10">
              <a
                href={`/apk/${apk.name}`}
                download
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-bold text-white shadow-lg transition-colors hover:bg-primary-container"
              >
                دانلود اپلیکیشن
              </a>
              <p className="mt-3 text-xs text-outline">نسخه {apk.version || apk.name}</p>
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-outline-variant/60 bg-surface px-6 py-5">
              <p className="text-sm font-bold text-primary">به‌زودی در دسترس</p>
              <p className="mt-2 text-xs leading-6 text-outline">
                اپلیکیشن اندروید در حال آماده‌سازی است. پس از انتشار، همین صفحه برای دانلود فعال می‌شود.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
