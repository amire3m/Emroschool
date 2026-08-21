import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToasterProvider from "@/components/ToasterProvider";
import PushManager from "@/components/push/PushManager";
import { siteName, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: "آموزش هنر و رسانه در تراز انقلاب اسلامی - آکادمی امام روح‌الله",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName,
  },
  icons: {
    icon: "/api/favicon?v=3",
    shortcut: "/api/favicon?v=3",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteName,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#03004b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html dir="rtl" lang="fa">
      <body className="min-h-screen flex flex-col">
        <ToasterProvider />
        {children}
        <PushManager />
      </body>
    </html>
  );
}
