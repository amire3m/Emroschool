"use client";

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
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
  Bell,
  History,
  Mail,
  Settings,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { getCookie, removeCookie } from "@/lib/cookie";
import { getFontFamily } from "@/lib/fonts";

interface MenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string[] | null;
  wipe?: boolean;
}

interface MenuGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  children: MenuLink[];
}

const NAV: Array<MenuLink | MenuGroup> = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, permission: null },
  {
    key: "education",
    label: "آموزش",
    icon: BookOpen,
    children: [
      { href: "/admin/courses", label: "دوره‌ها", icon: BookOpen, permission: ["courses"] },
      { href: "/admin/events", label: "رویدادها", icon: CalendarDays, permission: ["events"] },
      { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderOpen, permission: ["courses"] },
    ],
  },
  { href: "/admin/applications", label: "درخواست‌های ثبت‌نام", icon: ClipboardList, permission: ["applications"] },
  { href: "/admin/payments", label: "پرداخت‌ها", icon: WalletCards, permission: ["payments", "support"] },
  { href: "/admin/discount-codes", label: "کدهای تخفیف", icon: BadgePercent, permission: ["discounts", "settings"] },
  { href: "/admin/support", label: "پشتیبانی کاربران", icon: Users, permission: ["support"] },
  { href: "/admin/gallery", label: "گالری", icon: Image, permission: ["gallery"] },
  { href: "/admin/news", label: "اخبار", icon: Newspaper, permission: ["news"], wipe: true },
  { href: "/admin/files", label: "مدیریت فایل‌ها", icon: HardDrive, permission: ["files"] },
  { href: "/admin/notifications", label: "اعلان‌ها", icon: Bell, permission: ["notifications"] },
  { href: "/admin/email", label: "ایمیل", icon: Mail, permission: ["settings"] },
  { href: "/admin/updates", label: "بروزرسانی‌ها", icon: History, permission: null },
  {
    key: "users",
    label: "کاربران",
    icon: Users,
    children: [
      { href: "/admin/users", label: "همه کاربران", icon: Users, permission: ["users"] },
      { href: "/admin/instructors", label: "اساتید", icon: GraduationCap, permission: ["instructors"] },
      { href: "/admin/alumni", label: "هنرآموختگان", icon: GraduationCap, permission: ["instructors"] },
    ],
  },
  {
    key: "settings",
    label: "تنظیمات سایت",
    icon: Settings,
    children: [
      { href: "/admin/settings", label: "تنظیمات سایت", icon: Settings, permission: ["settings"] },
      { href: "/admin/slider", label: "اسلایدر", icon: Image, permission: ["slider"] },
      { href: "/admin/partners", label: "همراهان", icon: Users, permission: null },
    ],
  },
  { href: "/", label: "بازگشت به سایت", icon: ArrowLeft, permission: null },
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [newsWipe, setNewsWipe] = useState<"idle" | "cover" | "reveal">("idle");
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const wipeToken = useRef(0);
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

  function cancelWipe(onNavigate?: () => void) {
    wipeToken.current += 1;
    if (newsWipe !== "idle") setNewsWipe("idle");
    onNavigate?.();
  }

  function handleWipeNav(event: ReactMouseEvent, href: string, onNavigate?: () => void) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      cancelWipe(onNavigate);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cancelWipe(onNavigate);
      return;
    }
    const startPath = pathnameRef.current;
    if (startPath === href || startPath.startsWith(`${href}/`)) {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    onNavigate?.();
    const token = ++wipeToken.current;
    setNewsWipe("cover");
    window.setTimeout(() => {
      if (wipeToken.current !== token || pathnameRef.current !== startPath) {
        setNewsWipe("idle");
        return;
      }
      router.push(href);
    }, 480);
    window.setTimeout(() => setNewsWipe("idle"), 4000);
  }

  useEffect(() => {
    if (pathname === "/admin/news" && newsWipe === "cover") {
      setNewsWipe("reveal");
      const timer = window.setTimeout(() => setNewsWipe("idle"), 400);
      return () => window.clearTimeout(timer);
    }
  }, [pathname, newsWipe]);

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

        <nav className="space-y-1">
          {NAV.map((entry) => {
            if ("children" in entry) {
              const visibleChildren = entry.children.filter((child) => canAccess(child.permission, child.href));
              if (visibleChildren.length === 0) return null;
              const groupActive = visibleChildren.some((child) => isActive(child.href));
              const expanded = Boolean(openGroups[entry.key]) || groupActive;
              const GroupIcon = entry.icon;
              return (
                <div key={entry.key}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((previous) => ({ ...previous, [entry.key]: !expanded }))}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[11px] font-bold transition ${LINK_FOCUS} ${
                      groupActive ? "text-slate-900" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    <GroupIcon size={16} className={groupActive ? "text-[#03004b]" : "text-slate-400"} />
                    <span className="flex-1 text-right">{entry.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="mr-3 mt-1 space-y-1 border-r border-slate-200 pr-2">
                      {visibleChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={(event) => {
                              if (child.wipe) handleWipeNav(event, child.href, onNavigate);
                              else cancelWipe(onNavigate);
                            }}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition ${LINK_FOCUS} ${
                              active ? "bg-[#03004b] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <ChildIcon size={17} className={active ? "text-white" : "text-slate-400"} />
                            <span className="flex-1 text-right">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (!canAccess(entry.permission, entry.href)) return null;
            const Icon = entry.icon;
            const active = isActive(entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={(event) => {
                  if (entry.wipe) handleWipeNav(event, entry.href, onNavigate);
                  else cancelWipe(onNavigate);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${LINK_FOCUS} ${
                  active ? "bg-[#03004b] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} className={active ? "text-white" : "text-slate-400"} />
                <span className="flex-1 text-right">{entry.label}</span>
              </Link>
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

      {newsWipe !== "idle" && (
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center gap-3 bg-[#03004b] text-white transition-transform duration-500 ease-[cubic-bezier(0.22,0.8,0.24,1)] ${
            newsWipe === "cover" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Newspaper size={28} />
          </span>
          <span className="text-2xl font-black">اخبار</span>
        </div>
      )}
    </div>
  );
}
