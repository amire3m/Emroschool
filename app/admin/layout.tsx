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
} from "lucide-react";
import { getCookie, removeCookie } from "@/lib/cookie";

const menuItems = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/slider", label: "اسلایدر", icon: Image },
  { href: "/admin/courses", label: "دوره‌ها", icon: BookOpen },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderOpen },
  { href: "/admin/events", label: "رویدادها", icon: Calendar },
  { href: "/admin/instructors", label: "اساتید", icon: GraduationCap },
  { href: "/admin/gallery", label: "گالری", icon: Image },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/admin/notifications", label: "اعلان‌ها", icon: Bell },
  { href: "/admin/alumni", label: "هنرآموختگان", icon: GraduationCap },
  { href: "/admin/pagebuilder", label: "صفحه اصلی", icon: Edit },
  { href: "/", label: "بازگشت به سایت", icon: ArrowLeft },
];

const pageTitles: Record<string, string> = {
  "/admin": "داشبورد",
  "/admin/slider": "مدیریت اسلایدر",
  "/admin/courses": "مدیریت دوره‌ها",
  "/admin/categories": "دسته‌بندی دوره‌ها",
  "/admin/events": "مدیریت رویدادها",
  "/admin/instructors": "مدیریت اساتید",
  "/admin/gallery": "گالری تصاویر",
  "/admin/users": "مدیریت کاربران",
  "/admin/notifications": "اعلان‌ها",
  "/admin/pagebuilder": "ویرایش صفحه اصلی",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");

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
      .then((data) => setUserName(data.user?.name || "کاربر"))
      .catch(() => router.push("/login"));
  }, [router]);

  const handleLogout = () => {
    removeCookie("token");
    router.push("/login");
  };

  const pageTitle = pageTitles[pathname] || "داشبورد";

  return (
    <div className="flex h-screen overflow-hidden bg-surface font-doran" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-30 h-full w-[280px] bg-[#03004b] text-white flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo.png" alt="لوگو" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#ffdeab]">آکادمی هنر و رسانه</h2>
              <p className="text-xs text-white/50 mt-0.5">امام روح‌الله (ره)</p>
            </div>
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
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link ${
                  isActive ? "!bg-[rgba(255,222,171,0.1)] !text-[#ffdeab]" : "text-white/70"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="sidebar-link text-white/50 text-sm">
            <span>نسخه ۱.۰</span>
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
