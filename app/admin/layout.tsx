"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Image,
  Users,
  Edit,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FolderOpen,
  Calendar,
  GraduationCap,
  Bell,
  Mail,
  Settings,
  HardDrive,
  History,
  ClipboardList,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { getCookie, removeCookie } from "@/lib/cookie";
import { APP_VERSION } from "@/lib/version";
import { getFontFamily } from "@/lib/fonts";

interface MenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string | null;
}

interface MenuGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  children: MenuLink[];
}

const menuItems: Array<MenuLink | MenuGroup> = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, permission: null },
  { href: "/admin/courses", label: "دوره‌ها", icon: BookOpen, permission: "courses" },
  { href: "/admin/applications", label: "درخواست‌های ثبت‌نام", icon: ClipboardList, permission: "applications" },
  { href: "/admin/payments", label: "پرداخت‌ها", icon: WalletCards, permission: "payments" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderOpen, permission: "courses" },
  { href: "/admin/events", label: "رویدادها", icon: Calendar, permission: "events" },
  { href: "/admin/gallery", label: "گالری", icon: Image, permission: "gallery" },
  { href: "/admin/files", label: "مدیریت فایل‌ها", icon: HardDrive, permission: "files" },
  { href: "/admin/notifications", label: "اعلان‌ها", icon: Bell, permission: "notifications" },
  { href: "/admin/email", label: "ارسال ایمیل", icon: Mail, permission: "settings" },
  { href: "/admin/updates", label: "بروزرسانی‌ها", icon: History, permission: null },
  {
    key: "users",
    label: "کاربران",
    icon: Users,
    children: [
      { href: "/admin/users", label: "همه کاربران", icon: Users, permission: "users" },
      { href: "/admin/instructors", label: "اساتید", icon: GraduationCap, permission: "instructors" },
      { href: "/admin/alumni", label: "هنرآموختگان", icon: GraduationCap, permission: "instructors" },
    ],
  },
  {
    key: "settings",
    label: "تنظیمات سایت",
    icon: Settings,
    children: [
      { href: "/admin/settings", label: "تنظیمات سایت", icon: Settings, permission: "settings" },
      { href: "/admin/slider", label: "اسلایدر", icon: Image, permission: "slider" },
      { href: "/admin/partners", label: "همراهان", icon: Users, permission: null },
    ],
  },
  { href: "/", label: "بازگشت به سایت", icon: ArrowLeft, permission: null },
];

const pageTitles: Record<string, string> = {
  "/admin": "داشبورد",
  "/admin/slider": "مدیریت اسلایدر",
  "/admin/courses": "مدیریت دوره‌ها",
  "/admin/applications": "درخواست‌های ثبت‌نام دوره‌ها",
  "/admin/payments": "مدیریت پرداخت‌ها",
  "/admin/discount-codes": "مدیریت کدهای تخفیف",
  "/admin/categories": "دسته‌بندی دوره‌ها",
  "/admin/events": "مدیریت رویدادها",
  "/admin/instructors": "مدیریت اساتید",
  "/admin/alumni": "مدیریت هنرآموختگان",
  "/admin/gallery": "گالری تصاویر",
  "/admin/files": "مدیریت فایل‌ها",
  "/admin/users": "مدیریت کاربران",
  "/admin/notifications": "اعلان‌ها",
  "/admin/email": "ارسال ایمیل از دامنه آکادمی",
  "/admin/updates": "بروزرسانی‌ها",
  "/admin/partners": "مدیریت همراهان",
  "/admin/settings": "تنظیمات سایت",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
          setSettings(data);
          document.documentElement.style.setProperty("--site-font", `'${getFontFamily(data.siteFont)}', sans-serif`);
          if (data.bgColor) document.body.style.backgroundColor = data.bgColor;
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = () => {
    removeCookie("token");
    router.push("/login");
  };

  const pageTitle = pageTitles[pathname] || "داشبورد";
  const compactSidebar = settings?.sidebarLayout === "compact";

  const canAccess = (item: MenuLink) => {
    if (userRole === "superadmin") return true;
    if (userRole === "admin" && userPermissions.length === 0) return true;
    if (item.href === "/admin" || item.href === "/") return true;
    if (!item.permission) return userRole === "admin";
    return userPermissions.includes(item.permission);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface font-site" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-30 h-full text-white flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${
          compactSidebar ? "w-[72px]" : "w-[280px]"
        } ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
        style={{ backgroundColor: settings?.sidebarColor || "#03004b" }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center overflow-hidden shrink-0">
              <img src={settings?.siteLogo || "/logo.png"} alt="لوگو" className="w-full h-full object-cover" />
            </div>
            {!compactSidebar && (
              <div>
                <h2 className="text-sm font-black text-[#ffdeab]">سامانه آکادمی هنر و رسانه</h2>
                <p className="text-xs text-white/50 mt-0.5">نسخه ویژه مؤسسه امام روح‌الله (ره)</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/70 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            if ("children" in item) {
              const visibleChildren = item.children.filter(canAccess);
              if (visibleChildren.length === 0) return null;
              const groupActive = visibleChildren.some((child) => pathname.startsWith(child.href));
              const expanded = Boolean(openGroups[item.key]) || groupActive;
              const GroupIcon = item.icon;
              return <div key={item.key}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((previous) => ({ ...previous, [item.key]: !expanded }))}
                  className={`sidebar-link w-full ${groupActive ? "!bg-[rgba(255,222,171,0.1)] !text-[#ffdeab]" : "text-white/70"} ${compactSidebar ? "justify-center !px-2" : ""}`}
                  title={compactSidebar ? item.label : undefined}
                >
                  <GroupIcon size={compactSidebar ? 22 : 20} />
                  {!compactSidebar && <><span className="flex-1 text-right">{item.label}</span><ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} /></>}
                </button>
                {expanded && <div className={`mt-1 space-y-1 ${compactSidebar ? "" : "mr-3 border-r border-white/10 pr-2"}`}>
                  {visibleChildren.map((child) => {
                    const ChildIcon = child.icon;
                    const active = pathname.startsWith(child.href);
                    return <Link key={child.href} href={child.href} onClick={() => setSidebarOpen(false)} className={`sidebar-link !py-2 text-sm ${active ? "!bg-[rgba(255,222,171,0.1)] !text-[#ffdeab]" : "text-white/55"} ${compactSidebar ? "justify-center !px-2" : ""}`} title={compactSidebar ? child.label : undefined}><ChildIcon size={17} />{!compactSidebar && <span>{child.label}</span>}</Link>;
                  })}
                </div>}
              </div>;
            }

            if (!canAccess(item)) return null;
            const Icon = item.icon;
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`sidebar-link ${isActive ? "!bg-[rgba(255,222,171,0.1)] !text-[#ffdeab]" : "text-white/70"} ${compactSidebar ? "justify-center !px-2" : ""}`} title={compactSidebar ? item.label : undefined}><Icon size={compactSidebar ? 22 : 20} />{!compactSidebar && <span>{item.label}</span>}</Link>;
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="sidebar-link text-white/50 text-sm">
            <span>نسخه {APP_VERSION}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-surface-variant flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-primary hover:text-primary/70"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold text-primary">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-outline">
              <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                {userName.charAt(0)}
              </div>
              <span className="text-primary font-medium">{userName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-outline hover:text-error transition-colors px-3 py-1.5 rounded-xl hover:bg-error-container"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6"
          style={{
            backgroundColor: settings?.bgColor || undefined,
            backgroundImage: settings?.bgPattern ? `url(${settings.bgPattern})` : undefined,
          }}
        >{children}</main>
      </div>
    </div>
  );
}
