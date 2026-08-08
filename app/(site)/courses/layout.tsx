import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "دوره‌های هنر و رسانه",
  description: "دوره‌های تخصصی هنر و رسانه آکادمی امام روح‌الله (ره) را مشاهده و مسیر یادگیری خود را انتخاب کنید.",
  alternates: { canonical: "/courses" },
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
