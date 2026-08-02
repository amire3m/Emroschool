"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, Search, Bell, CheckCheck } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import AnimatedSearchBar from "@/components/ui/animated-search-bar";

const MAGAZINE_SITE = process.env.NEXT_PUBLIC_MAGAZINE_URL || "https://mag.imamruhollahschool.com";
const navLinks = [
  { label: "صفحه اصلی", href: "/" },
  { label: "دوره‌ها", href: "/courses" },
  { label: "رویدادها", href: "/events" },
  { label: "مجله", href: MAGAZINE_SITE },
  { label: "اساتید", href: "/instructors" },
  { label: "هنر آموختگان", href: "/honar-amooztegan" },
  { label: "درباره ما", href: "/about" },
];

const HEADER_LOGO = "https://imamruhollahschool.com/uploads/1785365353558-5c082fe5-logo-main.png";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  userNotificationId: string;
}

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [sidebarColor, setSidebarColor] = useState("#03004b");
  const [sidebarLayout, setSidebarLayout] = useState("default");

  useEffect(() => {
    async function syncAuth() {
      const token = getCookie("token");
      setIsLoggedIn(Boolean(token));
      setUserRole("");
      if (!token) return;
      try {
        const response = await fetch("/api/auth/me", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) setUserRole(data.user?.role || "");
      } catch {
        setIsLoggedIn(false);
      }
    }

    syncAuth();
    window.addEventListener("auth-changed", syncAuth);

    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          if (d.sidebarColor) setSidebarColor(d.sidebarColor);
          if (d.sidebarLayout) setSidebarLayout(d.sidebarLayout);
        }
      })
      .catch(() => {});

    return () => window.removeEventListener("auth-changed", syncAuth);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchNotifications() {
    const token = getCookie("token");
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications((data.notifications || []).slice(0, 5));
      }
    } catch {
    } finally {
      setNotifLoading(false);
    }
  }

  function toggleNotif() {
    if (!notifOpen) {
      fetchNotifications();
    }
    setNotifOpen(!notifOpen);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  async function openNotification(notification: NotificationItem) { setSelectedNotification(notification); if (!notification.read) { const token = getCookie("token"); await fetch(`/api/notifications/${notification.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }); setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item)); } }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-24 transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-md shadow-sm"
            : ""
        } ${sidebarLayout === "compact" ? "py-1" : scrolled ? "py-2" : "py-4"}`}
        style={{ backgroundColor: scrolled ? `${sidebarColor}dd` : sidebarColor }}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <svg viewBox="330 610 1380 790" role="img" aria-label="آکادمی هنر و رسانه امام روح‌الله" className="h-14 md:h-16 w-auto max-w-[125px] md:max-w-[145px] overflow-visible">
                <image href={HEADER_LOGO} width="2048" height="2048" preserveAspectRatio="xMidYMid meet" />
              </svg>
              <span className="hidden xl:block text-secondary-fixed font-bold text-xs whitespace-nowrap">آکادمی هنر و رسانه امام روح‌الله (ره)</span>
            </Link>
            <div className="hidden lg:block"><AnimatedSearchBar /></div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-surface-variant hover:text-secondary-fixed transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="lg:hidden text-secondary-fixed p-1"
            >
              <Search size={20} />
            </button>
            {isLoggedIn ? (
              <>
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={toggleNotif}
                    className="relative text-secondary-fixed p-2 hover:bg-secondary-fixed/10 rounded-lg transition-colors"
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden z-50">
                      <div className="p-4 border-b border-outline-variant/20">
                        <p className="font-bold text-primary text-sm">اعلان‌ها</p>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifLoading ? (
                          <div className="p-6 text-center">
                            <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell size={24} className="mx-auto text-outline-variant mb-2" />
                            <p className="text-outline text-sm">اعلانی وجود ندارد</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <button type="button" onClick={() => openNotification(notif)}
                              key={notif.id}
                              className={`w-full p-4 border-b border-outline-variant/10 text-right text-sm transition-colors ${
                                notif.read ? "" : "bg-secondary-fixed/10"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {!notif.read && (
                                  <span className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm ${
                                      notif.read
                                        ? "text-outline"
                                        : "text-primary font-bold"
                                    }`}
                                  >
                                    {notif.title}
                                  </p>
                                  <p className="text-outline text-xs mt-0.5 line-clamp-2">
                                    {notif.message}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setNotifOpen(false)}
                        className="block text-center text-secondary font-bold text-sm p-3 hover:bg-surface-low transition-colors border-t border-outline-variant/20"
                      >
                        مشاهده همه
                      </Link>
                    </div>
                  )}
                </div>
                <Link
                  href={userRole === "admin" || userRole === "superadmin" ? "/admin" : "/dashboard"}
                  className="bg-secondary text-white px-5 py-2 rounded-lg font-bold hover:bg-secondary-container transition-all active:scale-95 text-sm"
                >
                  {userRole === "admin" || userRole === "superadmin" ? "پنل مدیریت" : "داشبورد"}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-secondary text-white px-5 py-2 rounded-lg font-bold hover:bg-secondary-container transition-all active:scale-95 text-sm"
              >
                ورود / ثبت‌نام
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-secondary-fixed p-1"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="lg:hidden px-5 pb-3 pt-2">
            <AnimatedSearchBar expanded autoFocus onSubmit={() => setSearchOpen(false)} />
          </div>
        )}
      </nav>
      {selectedNotification && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/60 p-4" onClick={() => setSelectedNotification(null)}><section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-4"><h2 className="text-lg font-black text-primary">{selectedNotification.title}</h2><button onClick={() => setSelectedNotification(null)} className="text-outline"><X size={20} /></button></div><p className="whitespace-pre-line text-sm leading-8 text-outline">{selectedNotification.message}</p><p className="mt-5 text-xs text-outline">{new Date(selectedNotification.createdAt).toLocaleDateString("fa-IR")}</p></section></div>}

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden pt-16">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative bg-primary px-5 py-6 shadow-xl">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-surface-variant hover:text-secondary-fixed transition-colors text-base py-2 border-b border-white/5"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
