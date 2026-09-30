import type { Metadata } from "next";
import AdminLookSample from "@/components/admin/admin-look-sample";

export const metadata: Metadata = {
  title: "پیش‌نمایش طراحی جدید پنل ادمین",
  robots: { index: false, follow: false },
};

export default function AdminLookPage() {
  return <AdminLookSample />;
}
