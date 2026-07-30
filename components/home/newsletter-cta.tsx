"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft, Check, Mail, SendHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewsletterCta({ title, description, isLoggedIn }: { title: string; description: string; isLoggedIn: boolean }) {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);
  const dragX = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 420, damping: 34, mass: 0.7 });
  const progress = useTransform(springX, [0, 170], [0, 1]);
  const fillWidth = useTransform(springX, (x) => `${x + 52}px`);

  function finish() {
    if (completed) return;
    if (progress.get() >= 0.82) {
      setCompleted(true);
      window.setTimeout(() => router.push(isLoggedIn ? "/dashboard/profile" : "/register"), 650);
    } else {
      dragX.set(0);
    }
  }

  return (
    <section className="relative mx-5 my-20 overflow-hidden rounded-[2.5rem] bg-[#03004b] text-white shadow-[0_25px_80px_rgba(3,0,75,.22)] md:mx-auto md:max-w-[1280px]" dir="rtl">
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 15% 20%, #ffdeab 0, transparent 27%), radial-gradient(circle at 85% 80%, #7b5814 0, transparent 32%)" }} />
      <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full border border-secondary-fixed/20" />
      <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full border border-secondary-fixed/10" />
      <div className="relative grid gap-12 px-7 py-12 md:grid-cols-[1fr_360px] md:items-center md:px-16 md:py-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary-fixed/30 bg-white/10 px-4 py-2 text-xs font-bold text-secondary-fixed"><Sparkles size={15} /> باشگاه هنرمندان آکادمی</div>
          <h2 className="max-w-2xl text-3xl font-black leading-[1.45] md:text-5xl">{title}</h2>
          <p className="mt-5 max-w-2xl text-sm leading-8 text-white/65 md:text-base">{description}</p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/60"><span className="rounded-full bg-white/10 px-4 py-2">دوره‌های تازه</span><span className="rounded-full bg-white/10 px-4 py-2">رویدادهای ویژه</span><span className="rounded-full bg-white/10 px-4 py-2">فرصت‌های رشد</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[320px]">
          <div className="absolute -inset-5 rounded-[2rem] border border-secondary-fixed/20" />
          <div className="relative rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-2xl bg-secondary-fixed p-3 text-primary"><Mail size={22} /></div><div><p className="font-bold">{isLoggedIn ? "عضویت در خبرنامه" : "ورود به جمع ما"}</p><p className="mt-1 text-xs text-white/55">فقط یک حرکت تا شروع مسیر</p></div></div>
            <div className="relative h-14 rounded-full bg-black/20 p-1" dir="ltr">
              <motion.div className="absolute inset-y-1 left-1 rounded-full bg-secondary-fixed/20" style={{ width: fillWidth }} />
              {!completed ? <motion.button type="button" drag="x" dragConstraints={{ left: 0, right: 170 }} dragElastic={0.04} dragMomentum={false} style={{ x: springX }} onDragEnd={finish} className="absolute left-1 top-1 z-10 flex h-12 w-12 cursor-grab items-center justify-center rounded-full bg-secondary-fixed text-primary shadow-lg active:cursor-grabbing"><SendHorizontal size={20} /></motion.button> : <motion.div initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 flex items-center justify-center gap-2 text-secondary-fixed"><Check size={20} /> آماده شد!</motion.div>}
              {!completed && <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/60">برای عضویت بکشید ←</span>}
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-white/45"><span>بدون پیام اضافی</span><ArrowLeft size={14} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
