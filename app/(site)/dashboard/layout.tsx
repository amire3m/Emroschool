"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  User,
  LogOut,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { getCookie, removeCookie, setCookie } from "@/lib/cookie";

const menuItems = [
  { label: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
  { label: "دوره‌های من", href: "/dashboard/courses", icon: BookOpen },
  { label: "پروفایل", href: "/dashboard/profile", icon: User },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const token = getCookie("token");
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("unauthorized");
        const data = await res.json();
        setUser(data.user);
      } catch {
        removeCookie("token");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
    window.addEventListener("profile-updated", fetchUser);
    return () => window.removeEventListener("profile-updated", fetchUser);
  }, [router]);

  useEffect(() => {
    setIsImpersonating(Boolean(sessionStorage.getItem("impersonator-token")));
  }, []);

  function handleLogout() {
    removeCookie("token");
    window.dispatchEvent(new Event("auth-changed"));
    router.push("/login");
  }

  function exitImpersonation() {
    const adminToken = sessionStorage.getItem("impersonator-token");
    if (!adminToken) return;
    setCookie("token", adminToken);
    sessionStorage.removeItem("impersonator-token");
    setIsImpersonating(false);
    window.dispatchEvent(new Event("auth-changed"));
    router.push("/admin/users");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex pt-24">
      <aside
        className={`fixed right-0 top-24 h-[calc(100vh-96px)] w-64 bg-primary z-40 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        } md:translate-x-0 md:block shadow-xl`}
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden border-2 border-secondary-fixed bg-secondary-fixed" style={{ borderRadius: "50%", aspectRatio: "1 / 1" }}>
              {user?.avatar ? <img src={user.avatar} alt="آواتار کاربر" className="block h-full w-full object-cover" style={{ borderRadius: "50%" }} /> : <span className="flex h-full w-full items-center justify-center text-primary font-bold">{user?.name?.charAt(0) || "U"}</span>}
            </div>
            <div className="text-right">
              <p className="text-secondary-fixed font-bold text-sm">
                {user?.name}
              </p>
              <p className="text-surface-variant text-xs opacity-70">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-secondary-fixed/20 text-secondary-fixed"
                    : "text-surface-variant hover:bg-secondary-fixed/10 hover:text-secondary-fixed"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-surface-variant hover:bg-error/10 hover:text-error transition-all w-full mt-6"
          >
            <LogOut size={20} />
            <span>خروج</span>
          </button>
        </nav>
      </aside>

      <div className="flex-1 mr-0 md:mr-64">
        {isImpersonating && <div className="sticky top-24 z-30 flex items-center justify-between gap-3 bg-amber-100 px-6 py-3 text-sm font-bold text-amber-950"><span>شما در حالت ورود به حساب کاربر هستید.</span><button onClick={exitImpersonation} className="rounded-lg bg-primary px-3 py-1.5 text-white">بازگشت به پنل مدیریت</button></div>}
        <div className="md:hidden fixed top-24 left-4 z-50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="bg-primary text-secondary-fixed p-2 rounded-lg shadow-lg"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
