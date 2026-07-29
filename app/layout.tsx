import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مدرسه هنر و رسانه امام روح‌الله | Honar & Media",
  description: "آموزش هنر و رسانه در تراز انقلاب اسلامی - مدرسه امام روح‌الله",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html dir="rtl" lang="fa">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
