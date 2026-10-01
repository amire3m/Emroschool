"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  WalletCards,
  BadgePercent,
  BookOpen,
  CalendarDays,
  FolderOpen,
  Newspaper,
  Users,
  GraduationCap,
  Image,
  HardDrive,
  LifeBuoy,
  Bell,
  History,
  Handshake,
  SlidersHorizontal,
  Mail,
  Settings,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { getCookie, removeCookie } from "@/lib/cookie";
import { getFontFamily } from "@/lib/fonts";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string[] | null;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const NAV: MenuSection[] = [
  {
    title: "اصلی",
    items: [{ href: "/admin", label: "داشبورد", icon: LayoutDashboard, permission: null }],
  },
  {
    title: "مدیریت",
    items: [
      { href: "/admin/applications", label: "درخواست‌های ثبت‌نام", icon: ClipboardList, permission: ["applications"] },
      { href: "/admin/payments", label: "پرداخت‌ها", icon: WalletCards, permission: ["payments", "support"] },
      { href: "/admin/discount-codes", label: "کدهای تخفیف", icon: BadgePercent, permission: ["discounts", "settings"] },
      { href: "/admin/courses", label: "دوره‌ها", icon: BookOpen, permission: ["courses"] },
      { href: "/admin/events", label: "رویدادها", icon: CalendarDays, permission: ["events"] },
      { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderOpen, permission: ["courses"] },
      { href: "/admin/news", label: "اخبار", icon: Newspaper, permission: ["news"] },
      { href: "/admin/users", label: "کاربران", icon: Users, permission: ["users"] },
      { href: "/admin/instructors", label: "اساتید", icon: GraduationCap, permission: ["instructors"] },
      { href: "/admin/alumni", label: "هنرآموختگان", icon: GraduationCap, permission: ["instructors"] },
      { href: "/admin/gallery", label: "گالری", icon: Image, permission: ["gallery"] },
      { href: "/admin/files", label: "مدیریت فایل‌ها", icon: HardDrive, permission: ["files"] },
      { href: "/admin/support", label: "پشتیبانی کاربران", icon: LifeBuoy, permission: ["support"] },
      { href: "/admin/notifications", label: "اعلان‌ها", icon: Bell, permission: ["notifications"] },
      { href: "/admin/updates", label: "بروزرسانی‌ها", icon: History, permission: null },
      { href: "/admin/partners", label: "همراهان", icon: Handshake, permission: null },
      { href: "/admin/slider", label: "اسلایدر", icon: SlidersHorizontal, permission: ["slider"] },
      { href: "/admin/email", label: "ایمیل", icon: Mail, permission: ["settings"] },
    ],
  },
  {
    title: "سیستم",
    items: [
      { href: "/admin/settings", label: "تنظیمات سایت", icon: Settings, permission: ["settings"] },
      { href: "/", label: "بازگشت به سایت", icon: ArrowLeft, permission: null },
    ],
  },
];

function roleLabel(role: string) {
  if (role === "superadmin") return "مدیر ارشد";
  if (role === "admin") return "مدیر";
  return role || "مدیر";
}

const LINK_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03004b]";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [siteLogo, setSiteLogo] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        const u = data.user;
        if (!u || (u.role !== "admin" && u.role !== "superadmin")) {
          router.push("/");
          return;
        }
        setUserName(u.name || "کاربر");
        setUserRole(u.role);
        try { setUserPermissions(JSON.parse(u.permissions || "[]")); } catch { setUserPermissions([]); }
      })
      .catch(() => router.push("/login"));

    fetch("/api/site-settings")
      .then(async (r) => {
        const text = await r.text();
        try { return JSON.parse(text); } catch { return {}; }
      })
      .then((data) => {
        if (!data.error) {
          if (data.siteLogo) setSiteLogo(data.siteLogo);
          document.documentElement.style.setProperty("--site-font", `'${getFontFamily(data.siteFont)}', sans-serif`);
        }
      })
      .catch(() => {});
    document.body.style.backgroundColor = "#f4f6fa";
  }, [router]);

  const handleLogout = () => {
    removeCookie("token");
    router.push("/login");
  };

  const canAccess = (permission: string[] | null, href: string) => {
    if (userRole === "superadmin") return true;
    if (userRole === "admin" && userPermissions.length === 0) return true;
    if (href === "/admin" || href === "/") return true;
    if (!permission) return userRole === "admin";
    return permission.some((p) => userPermissions.includes(p));
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="flex items-center gap-3 px-2 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#03004b] text-lg font-black text-white">
            {siteLogo ? <img src={siteLogo} alt="لوگو" className="h-full w-full object-cover" /> : "ا"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900">پنل مدیریت</p>
            <p className="text-[11px] text-slate-500">آکادمی امام روح‌الله</p>
          </div>
          {onNavigate ? (
            <button
              type="button"
              onClick={onNavigate}
              aria-label="بستن منو"
              className={`rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${LINK_FOCUS}`}
            >
              <X size={20} />
            </button>
          ) : null}
        </div>

        <nav className="space-y-5">
          {NAV.map((section) => {
            const visible = section.items.filter((item) => canAccess(item.permission, item.href));
            if (visible.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="px-3 pb-1.5 text-[11px] font-bold text-slate-400">{section.title}</p>
                <div className="space-y-1">
                  {visible.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${LINK_FOCUS} ${
                          active ? "bg-[#03004b] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Icon size={18} className={active ? "text-white" : "text-slate-400"} />
                        <span className="flex-1 text-right">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#03004b] text-sm font-black text-white">
            {userName.charAt(0) || "م"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-slate-900">{userName || "مدیر"}</p>
            <p className="text-[11px] text-slate-500">نقش: {roleLabel(userRole)}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="خروج"
            aria-label="خروج"
            className={`shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 ${LINK_FOCUS}`}
          >
            <LogOut size={16} />
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa] font-site text-slate-900" dir="rtl">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        <aside className="sticky top-6 hidden h-fit max-h-[calc(100vh-3rem)] w-64 shrink-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 md:block">
          <SidebarContent />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="باز کردن منو"
        className={`fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#03004b] text-white shadow-lg transition hover:bg-[#1b1c5e] md:hidden ${LINK_FOCUS}`}
      >
        <Menu size={22} />
      </button>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-4 right-4 flex w-72 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
