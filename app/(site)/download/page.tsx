import type { Metadata } from "next";
import { MonitorSmartphone, Bell } from "lucide-react";
import { siteName } from "@/lib/seo";
import InstallPwaButton from "@/components/pwa/InstallPwaButton";

export const metadata: Metadata = {
  title: `نصب اپلیکیشن | ${siteName}`,
  description: "نصب اپلیکیشن آکادمی هنر و رسانه امام روح‌الله (ره) از طریق افزودن به صفحه اصلی، همراه با دریافت اعلان و دسترسی سریع.",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-surface pb-20 pt-28">
      <div className="mx-auto max-w-2xl px-5 md:px-8">
        <div className="rounded-[2rem] border border-outline-variant/40 bg-white p-7 text-center shadow-sm md:p-12">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512x512.png" alt="آیکن اپلیکیشن" className="h-full w-full object-cover" />
          </div>
          <p className="mt-8 text-sm font-bold tracking-[.18em] text-secondary">اپلیکیشن</p>
          <h1 className="mt-4 text-3xl font-black text-primary md:text-4xl">نصب اپلیکیشن</h1>
          <p className="mt-3 text-sm leading-7 text-outline">
            اپلیکیشن آکادمی هنر و رسانه امام روح‌الله (ره) را روی گوشی خود نصب کنید تا با دسترسی سریع و دریافت اعلان، تجربه بهتری داشته باشید.
          </p>

          <div className="mt-8">
            <InstallPwaButton />
          </div>

          <div className="mt-8 space-y-4 text-right">
            <div className="rounded-2xl border border-surface-variant bg-surface-low p-5">
              <p className="flex items-center gap-2 text-sm font-black text-primary">
                <MonitorSmartphone size={18} className="text-secondary" />
                اندروید (کروم)
              </p>
              <ol className="mt-3 space-y-2 text-xs leading-6 text-outline" dir="rtl">
                <li>۱. این صفحه را در مرورگر کروم باز کنید.</li>
                <li>۲. دکمه سه‌نقطه (⋮) در بالای مرورگر را بزنید.</li>
                <li>۳. گزینه <strong>افزودن به صفحه اصلی</strong> (Add to Home screen) را انتخاب کنید.</li>
                <li>۴. در پنجره باز شده روی <strong>افزودن</strong> بزنید.</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-surface-variant bg-surface-low p-5">
              <p className="flex items-center gap-2 text-sm font-black text-primary">
                <MonitorSmartphone size={18} className="text-secondary" />
                آیفون (سافاری)
              </p>
              <ol className="mt-3 space-y-2 text-xs leading-6 text-outline" dir="rtl">
                <li>۱. این صفحه را در مرورگر سافاری باز کنید.</li>
                <li>۲. دکمه <strong>Share</strong> (📤) را در نوار پایین بزنید.</li>
                <li>۳. گزینه <strong>افزودن به صفحه اصلی</strong> (Add to Home Screen) را انتخاب کنید.</li>
                <li>۴. روی <strong>افزودن</strong> بزنید.</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-secondary/30 bg-[#fffaf0] p-4">
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-primary">
              <Bell size={16} className="text-secondary" />
              اعلان‌ها
            </p>
            <p className="mt-2 text-xs leading-6 text-outline">
              پس از نصب، برای دریافت اعلان‌ها از دکمه «دریافت اعلان» در پایین سایت استفاده کنید و درخواست را تأیید کنید.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
