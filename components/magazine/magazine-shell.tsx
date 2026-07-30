"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, Bell, BookOpen, CheckCheck, Loader2, PenLine, UserRound, X } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import { APP_VERSION } from "@/lib/version";

const MAIN_SITE = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://imamruhollahschool.com";
interface MagazineSettings { title: string; description: string; logo: string | null; accentColor: string; font: string; }
interface NotificationItem { id: string; title: string; message: string; read?: boolean; createdAt: string; }

export default function MagazineShell({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<MagazineSettings>({ title: "مجله آکادمی امام روح‌الله (ره)", description: "روایت‌هایی از مسیر یادگیری و تجربه", logo: null, accentColor: "#ffdeab", font: "foran" });
  const [user, setUser] = useState<{ name: string; role: string; permissions: string | null } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/magazine-settings").then((response) => response.json()).then((data) => { if (!data.error) setSettings(data); }).catch(() => {});
    const token = getCookie("token");
    if (token) fetch("/api/auth/me", { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()).then((data) => setUser(data.user || null)).catch(() => {});
  }, []);
  useEffect(() => { const close = (event: MouseEvent) => { if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);

  async function toggleNotifications() {
    const nextOpen = !notificationOpen; setNotificationOpen(nextOpen);
    if (!nextOpen || notifications.length > 0) return;
    const token = getCookie("token"); if (!token) return;
    setNotificationLoading(true);
    try { const response = await fetch("/api/notifications", { headers: { authorization: `Bearer ${token}` } }); const data = await response.json(); if (response.ok) setNotifications((data.notifications || []).slice(0, 6)); } finally { setNotificationLoading(false); }
  }

  let canManage = false;
  if (user && ["admin", "superadmin"].includes(user.role)) {
    if (user.role === "superadmin" || !user.permissions) canManage = true;
    else { try { const permissions = JSON.parse(user.permissions); canManage = Array.isArray(permissions) && (permissions.length === 0 || permissions.includes("news")); } catch {} }
  }

  return <div className="min-h-screen flex flex-col" style={{ "--magazine-accent": settings.accentColor, fontFamily: settings.font === "kay" ? "Kay, sans-serif" : "Foran, sans-serif" } as React.CSSProperties}>
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-primary/90 backdrop-blur-xl text-white">
      <div className="max-w-[1280px] mx-auto h-20 px-5 md:px-8 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0">{settings.logo ? <img src={settings.logo} alt="" className="h-11 w-auto max-w-24 object-contain" /> : <span className="w-10 h-10 rounded-xl bg-secondary-fixed text-primary flex items-center justify-center rotate-3"><BookOpen size={20} /></span>}<div className="min-w-0"><p className="text-sm md:text-base font-black text-secondary-fixed truncate">{settings.title}</p><p className="hidden sm:block text-[10px] text-white/40 mt-0.5 truncate">روایت، تجربه، الهام</p></div></Link>
        <nav className="hidden md:flex items-center gap-3"><Link href="/" className="px-4 py-2 rounded-xl text-sm font-bold text-secondary-fixed bg-white/5">خانه مجله</Link><a href={MAIN_SITE} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/65 hover:text-secondary-fixed hover:bg-white/5 transition-colors">بازگشت به آکادمی<ArrowUpLeft size={15} /></a></nav>
        <div className="flex items-center gap-2">{canManage && <Link href="/mag-admin" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-secondary-fixed text-primary"><PenLine size={15} />تحریریه</Link>}{user ? <><div className="relative" ref={notificationRef}><button onClick={toggleNotifications} className="relative w-10 h-10 rounded-xl border border-white/10 text-secondary-fixed flex items-center justify-center hover:bg-white/5"><Bell size={18} />{notifications.some((item) => item.read === false) && <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-primary" />}</button>{notificationOpen && <div className="absolute left-0 top-full mt-3 w-[min(22rem,calc(100vw-2rem))] bg-white text-primary rounded-2xl shadow-2xl overflow-hidden border border-surface-variant"><div className="p-4 border-b border-surface-variant flex items-center justify-between"><p className="font-black text-sm">اعلان‌های آکادمی</p><CheckCheck size={16} className="text-outline" /></div><div className="max-h-80 overflow-y-auto">{notificationLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div> : notifications.length === 0 ? <p className="py-10 text-center text-sm text-outline">اعلانی وجود ندارد</p> : notifications.map((item) => <div key={item.id} className="p-4 border-b border-surface-variant last:border-0"><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-outline mt-1 line-clamp-2">{item.message}</p></div>)}</div></div>}</div><a href={`${MAIN_SITE}${["admin", "superadmin"].includes(user.role) ? "/admin" : "/dashboard"}`} className="w-10 h-10 rounded-xl border border-white/10 text-secondary-fixed flex items-center justify-center" title="حساب کاربری در سایت آکادمی"><UserRound size={18} /></a></> : <a href={`${MAIN_SITE}/login`} className="px-4 py-2.5 rounded-xl bg-secondary-fixed text-primary text-xs font-black">ورود در آکادمی</a>}<button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden w-10 h-10 flex items-center justify-center text-secondary-fixed">{mobileOpen ? <X size={20} /> : <span className="flex flex-col gap-1"><i className="block w-5 h-px bg-current" /><i className="block w-3 h-px bg-current" /></span>}</button></div>
      </div>
      {mobileOpen && <div className="md:hidden px-5 pb-5 border-t border-white/5 pt-4 flex flex-col gap-2"><Link href="/" onClick={() => setMobileOpen(false)} className="p-3 rounded-xl bg-white/5 text-secondary-fixed text-sm font-bold">خانه مجله</Link>{canManage && <Link href="/mag-admin" className="p-3 text-sm text-white/70">ورود به تحریریه</Link>}<a href={MAIN_SITE} className="p-3 text-sm text-white/70">بازگشت به سایت آکادمی</a></div>}
    </header>
    <div className="flex-1">{children}</div>
    <footer className="bg-[#020035] text-white border-t border-secondary-fixed/10"><div className="max-w-[1280px] mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6"><div><p className="font-black text-secondary-fixed">{settings.title}</p><p className="text-xs text-white/40 mt-2 max-w-lg leading-6">{settings.description}</p></div><div className="text-center md:text-left"><a href={MAIN_SITE} className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-secondary-fixed">مشاهده سایت آکادمی<ArrowUpLeft size={15} /></a><p className="text-[10px] text-white/25 mt-3">نسخه {APP_VERSION}</p></div></div></footer>
  </div>;
}
