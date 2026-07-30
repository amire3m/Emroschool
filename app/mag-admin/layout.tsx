"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ExternalLink, Loader2, LogOut, Newspaper, Settings } from "lucide-react";
import { getCookie, removeCookie } from "@/lib/cookie";

const MAIN_SITE = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://imamruhollahschool.com";

export default function MagazineAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const token = getCookie("token");
    if (!token) { window.location.href = `${MAIN_SITE}/login`; return; }
    fetch("/api/auth/me", { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()).then(({ user }) => {
      if (!user || !["admin", "superadmin"].includes(user.role)) { window.location.href = MAIN_SITE; return; }
      if (user.role !== "superadmin" && user.permissions) { try { const permissions = JSON.parse(user.permissions); if (Array.isArray(permissions) && permissions.length > 0 && !permissions.includes("news")) { window.location.href = MAIN_SITE; return; } } catch { window.location.href = MAIN_SITE; return; } }
      setName(user.name); setReady(true);
    }).catch(() => { window.location.href = `${MAIN_SITE}/login`; });
  }, []);

  if (!ready) return <div className="min-h-screen bg-primary flex items-center justify-center text-secondary-fixed"><Loader2 className="animate-spin" size={36} /></div>;
  const links = [{ href: "/mag-admin/posts", label: "مدیریت روایت‌ها", icon: Newspaper }, { href: "/mag-admin/settings", label: "تنظیمات مجله", icon: Settings }];
  return <div className="min-h-screen bg-[#f8f5ee] flex" dir="rtl">
    <aside className="fixed right-0 inset-y-0 w-20 md:w-64 bg-primary text-white z-40 flex flex-col"><Link href="/" className="h-20 border-b border-white/10 flex items-center justify-center md:justify-start md:px-6 gap-3"><span className="w-10 h-10 rounded-xl bg-secondary-fixed text-primary flex items-center justify-center rotate-3"><BookOpen size={19} /></span><span className="hidden md:block font-black text-secondary-fixed text-sm">تحریریه مجله</span></Link><nav className="p-3 space-y-2 flex-1">{links.map((item) => { const Icon = item.icon; const active = pathname.startsWith(item.href); return <Link key={item.href} href={item.href} title={item.label} className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl text-sm transition-colors ${active ? "bg-secondary-fixed text-primary font-black" : "text-white/60 hover:bg-white/5 hover:text-white"}`}><Icon size={19} /><span className="hidden md:block">{item.label}</span></Link>; })}</nav><div className="p-3 border-t border-white/10 space-y-2"><Link href="/" className="flex items-center justify-center md:justify-start gap-3 p-3 text-white/55 hover:text-secondary-fixed text-sm"><ExternalLink size={18} /><span className="hidden md:block">مشاهده مجله</span></Link><button onClick={() => { removeCookie("token"); window.location.href = MAIN_SITE; }} className="w-full flex items-center justify-center md:justify-start gap-3 p-3 text-white/45 hover:text-error text-sm"><LogOut size={18} /><span className="hidden md:block">خروج</span></button></div></aside>
    <main className="mr-20 md:mr-64 flex-1 min-w-0"><header className="h-20 bg-white/90 backdrop-blur border-b border-black/5 px-5 md:px-8 flex items-center justify-between sticky top-0 z-30"><div><p className="font-black text-primary">{pathname.includes("settings") ? "تنظیمات مجله" : "مدیریت روایت‌ها"}</p><p className="text-[11px] text-outline mt-1">پنل مستقل مجله آکادمی امام روح‌الله (ره)</p></div><span className="text-xs text-outline hidden sm:block">{name}</span></header><div className="p-4 md:p-8">{children}</div></main>
  </div>;
}
