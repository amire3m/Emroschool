"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

export default function Footer() {
  const [siteName, setSiteName] = useState("آکادمی هنر و رسانه امام روح‌الله (ره)");
  const [siteLogo, setSiteLogo] = useState("/logo.png");

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          if (d.siteName) setSiteName(d.siteName);
          if (d.siteLogo) setSiteLogo(d.siteLogo);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-primary text-surface-variant border-t border-secondary/20">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="text-right">
            <div className="flex items-center gap-3 mb-6 justify-end">
              <div className="w-14 h-14 rounded-full bg-secondary-fixed flex items-center justify-center overflow-hidden">
                <img src={siteLogo} alt="لوگو" className="w-full h-full object-cover" />
              </div>
            </div>
            <p className="text-sm leading-loose opacity-80 mb-8">
              {siteName}، نهادی تخصصی برای تربیت نیروی
              انسانی متعهد و متخصص در حوزه‌های مختلف هنری و رسانه‌ای است. ما به
              دنبال تلفیق هنر اصیل و تکنولوژی روز هستیم.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="https://www.instagram.com/imamruhollahschool/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="اینستاگرام آکادمی"
                className="w-11 h-11 rounded-xl bg-white/10 text-secondary-fixed flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </Link>
              <Link
                href="https://ble.ir/ImamRuhollahSchool"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="کانال بله آکادمی"
                className="w-11 h-11 rounded-xl bg-white/10 text-secondary-fixed flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.36 1.35 4.47 3.52 5.84L4.3 21l4.13-2.17c1.1.33 2.31.5 3.57.5 5.52 0 10-3.58 10-8.33C22 6.58 17.52 3 12 3Zm-3.2 7.1h6.4c.54 0 .98.44.98.98s-.44.98-.98.98H8.8a.98.98 0 1 1 0-1.96Z" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h5 className="text-secondary-fixed font-bold mb-6">
                لینک‌های سریع
              </h5>
              <ul className="space-y-3 text-sm opacity-80">
                <li>
                  <Link
                    href="/courses"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    دوره‌های حضوری
                  </Link>
                </li>
                <li>
                  <Link
                    href="/courses"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    آموزش مجازی
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    همایش‌ها
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    فراخوان‌های هنری
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="text-secondary-fixed font-bold mb-6">پشتیبانی</h5>
              <ul className="space-y-3 text-sm opacity-80">
                <li>
                  <Link
                    href="#"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    تماس با ما
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    قوانین و مقررات
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    سوالات متداول
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-secondary-fixed transition-colors"
                  >
                    مشاوره آموزشی
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h5 className="text-secondary-fixed font-bold flex items-center gap-2"><MapPin size={17} />موقعیت آکادمی</h5>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 h-48"><iframe title="موقعیت آکادمی امام روح‌الله روی نقشه" src="https://www.google.com/maps?q=35.699257969493395,51.39662703655142&z=16&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full h-full border-0 grayscale-[35%]" /></div>
            <a href="https://www.google.com/maps?q=35.699257969493395,51.39662703655142" target="_blank" rel="noopener noreferrer" className="text-xs text-white/55 hover:text-secondary-fixed">مشاهده مسیر در نقشه</a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 opacity-60 text-sm">
          <p>© ۱۴۰۵ تمامی حقوق برای {siteName} محفوظ است.</p>
           <div className="flex gap-6">
             <span>نسخه {APP_VERSION}</span>
           </div>
        </div>
      </div>
    </footer>
  );
}
