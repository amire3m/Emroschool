"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function VisitTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    fetch("/api/track-visit", { method: "POST" }).catch(() => {});
  }, [pathname]);

  return null;
}
