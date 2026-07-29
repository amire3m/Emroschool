import type { Metadata } from "next";
import "./globals.css";
import ToasterProvider from "@/components/ToasterProvider";

export const metadata: Metadata = {
  title: "آکادمی هنر و رسانه امام روح‌الله (ره)",
  description: "آموزش هنر و رسانه در تراز انقلاب اسلامی - آکادمی امام روح‌الله",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html dir="rtl" lang="fa">
      <body className="min-h-screen flex flex-col">
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
