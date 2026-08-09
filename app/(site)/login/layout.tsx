import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ورود به حساب کاربری",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
