"use client";

import { useEffect } from "react";
import ErrorExperience from "@/components/ui/error-experience";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error:", error); }, [error]);
  return <ErrorExperience code="500" title="یک وقفه کوتاه پیش آمد" description="در پردازش این صفحه مشکلی رخ داده است. اطلاعات شما محفوظ است؛ می‌توانید دوباره تلاش کنید یا به صفحه اصلی برگردید." retry={reset} />;
}
