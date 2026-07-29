"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Globe, Share2, AtSign } from "lucide-react";

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
            <div className="flex gap-3 justify-end">
              <Link
                href="https://www.instagram.com/imamruhollahschool/"
                target="_blank"
                className="w-10 h-10 rounded-full border border-secondary/30 flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-all"
              >
                <Globe size={18} />
              </Link>
              <Link
                href="https://ble.ir/ImamRuhollahSchool"
                target="_blank"
                className="w-10 h-10 rounded-full border border-secondary/30 flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-all"
              >
                <Share2 size={18} />
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

          <div className="flex flex-col items-center md:items-start gap-4">
            <h5 className="text-secondary-fixed font-bold mb-2">
              مجوزها و افتخارات
            </h5>
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center">
                <span className="text-3xl opacity-50 font-playfair">✓</span>
              </div>
              <div className="w-20 h-20 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center">
                <span className="text-3xl opacity-50 font-playfair">★</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 opacity-60 text-sm">
          <p>© ۱۴۰۵ تمامی حقوق برای {siteName} محفوظ است.</p>
          <div className="flex gap-6">
            <Link href="https://www.instagram.com/imamruhollahschool/" target="_blank">اینستاگرام</Link>
            <Link href="https://ble.ir/ImamRuhollahSchool" target="_blank">بله</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
