"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Home, RotateCcw, SearchX } from "lucide-react";

export default function ErrorExperience({ code, title, description, retry }: { code: "404" | "500"; title: string; description: string; retry?: () => void }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f5ff] px-5 py-16 text-right" dir="rtl">
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(#d9d3ee 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 32, repeat: Infinity, ease: "linear" }} className="absolute -right-48 -top-48 h-[520px] w-[520px] rounded-full border border-secondary/20" />
      <motion.div animate={{ rotate: -360 }} transition={{ duration: 42, repeat: Infinity, ease: "linear" }} className="absolute -bottom-64 -left-56 h-[560px] w-[560px] rounded-full border border-primary/10" />
      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white bg-white shadow-[0_30px_90px_rgba(3,0,75,.15)] md:grid-cols-[.9fr_1.1fr]">
        <div className="relative min-h-[330px] overflow-hidden bg-primary p-8 md:min-h-[520px] md:p-12">
          <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 25% 20%, #ffdeab 0, transparent 25%), radial-gradient(circle at 80% 80%, #7b5814 0, transparent 35%)" }} />
          <motion.div animate={{ y: [0, -12, 0], rotate: [0, 3, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="relative mx-auto flex h-full min-h-[260px] items-center justify-center">
            <svg viewBox="0 0 300 300" className="h-64 w-64 md:h-80 md:w-80" aria-hidden="true">
              <circle cx="150" cy="150" r="112" fill="none" stroke="#ffdeab" strokeWidth="2" opacity=".45" strokeDasharray="8 10" />
              <circle cx="150" cy="150" r="82" fill="#fff" opacity=".08" />
              <path d="M93 181c20 28 94 28 114 0M111 128h2M187 128h2" fill="none" stroke="#ffdeab" strokeWidth="11" strokeLinecap="round" />
              <path d="M122 160h56" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity=".85" />
              <text x="150" y="83" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="900" fontFamily="Arial">{code}</text>
            </svg>
          </motion.div>
          <div className="relative text-center text-xs font-bold tracking-[.2em] text-secondary-fixed">آکادمی هنر و رسانه امام روح‌الله</div>
        </div>
        <div className="flex flex-col justify-center p-8 md:p-14">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-surface-low px-4 py-2 text-xs font-bold text-secondary"><SearchX size={15} /> کد خطا {code}</div>
          <h1 className="text-3xl font-black leading-[1.45] text-primary md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-lg text-sm leading-8 text-outline md:text-base">{description}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-container"><Home size={18} />بازگشت به خانه</Link>
            {retry ? <button onClick={retry} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-bold text-primary transition hover:border-secondary hover:text-secondary"><RotateCcw size={18} />تلاش دوباره</button> : <Link href="/courses" className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-bold text-primary transition hover:border-secondary hover:text-secondary">مشاهده دوره‌ها<ArrowLeft size={18} /></Link>}
          </div>
          <p className="mt-10 border-t border-surface-variant pt-5 text-xs leading-6 text-outline">اگر مشکل ادامه داشت، چند لحظه بعد دوباره تلاش کنید یا از بخش تماس با ما پیام بگذارید.</p>
        </div>
      </section>
    </main>
  );
}
