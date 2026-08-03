"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

export default function Footer() {
  const [siteName, setSiteName] = useState("آکادمی هنر و رسانه امام روح‌الله (ره)");
  const footerLogo = "https://imamruhollahschool.com/uploads/1785365353558-5c082fe5-logo-main.png";

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          if (d.siteName) setSiteName(d.siteName);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-primary text-surface-variant border-t border-secondary/20">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="text-right">
             <div className="flex items-center justify-end mb-6">
               <svg viewBox="330 610 1380 790" role="img" aria-label="آکادمی هنر و رسانه امام روح‌الله" className="h-16 w-auto max-w-[170px] overflow-visible">
                 <image href={footerLogo} width="2048" height="2048" preserveAspectRatio="xMidYMid meet" />
               </svg>
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
                <img src="/bale-logo.svg?v=2" alt="" className="h-5 w-5 object-contain" />
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
                     href="/about#contact"
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
             <p className="text-sm leading-7 text-white/70">تهران، کارگر جنوبی، نظری، بین دانشگاه و قدیری، پلاک 72</p>
              <a href="https://nshn.ir/7bvh24IxOOVa" target="_blank" rel="noopener noreferrer" className="text-xs text-white/55 hover:text-secondary-fixed">مسیریابی در نشان</a>
          </div>
        </div>

        <section className="mt-12 border-t border-white/10 pt-8">
          <h5 className="text-center text-sm font-bold text-secondary-fixed">پیوندها</h5>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              ["رسانه رهبر انقلاب اسلامی", "https://rahbar.ir"],
              ["پایگاه اطلاع رسانی دفتر مقام معظم رهبری", "https://www.leader.ir/"],
              ["وزارت فرهنگ و ارشاد اسلامی", "https://www.farhang.gov.ir/"],
              ["پایگاه اطلاع رسانی ریاست جمهوری", "http://www.president.ir/"],
              ["پایگاه اطلاع رسانی دولت", "https://dolat.ir/"],
              ["پایگاه اطلاع رسانی دفتر حفظ و نشر آثار امام شهید", "https://khamenei.ir/"],
            ].map(([label, href]) => <Link key={href} href={href} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/75 transition hover:border-secondary-fixed hover:text-secondary-fixed">{label}</Link>)}
          </div>
        </section>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 opacity-60 text-sm">
          <p>© ۱۴۰۵ تمامی حقوق برای {siteName} محفوظ است.</p>
           <div className="flex gap-6">
             <span>نسخه ۲</span>
           </div>
        </div>
      </div>
    </footer>
  );
}
