"use client";

import { useEffect } from "react";
import "./globals.css";
import ErrorExperience from "@/components/ui/error-experience";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Global application error:", error); }, [error]);
  return <html dir="rtl" lang="fa"><body><ErrorExperience code="500" title="سامانه به یک وقفه رسید" description="خطای غیرمنتظره‌ای در سطح سامانه رخ داده است. با تلاش دوباره، مسیر را ادامه دهید." retry={reset} /></body></html>;
}
