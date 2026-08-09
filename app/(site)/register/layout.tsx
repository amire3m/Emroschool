import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ثبت‌نام در آکادمی",
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
