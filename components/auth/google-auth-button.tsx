"use client";

import { useSearchParams } from "next/navigation";

export default function GoogleAuthButton({ label }: { label: string }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const href = `/api/auth/google${redirect?.startsWith("/") && !redirect.startsWith("//") ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;
  return <a href={href} className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant bg-white py-3.5 text-sm font-bold text-primary transition hover:border-primary hover:bg-surface-low"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.75-.07-1.47-.19-2.16H12v4.09h5.24a4.48 4.48 0 0 1-1.94 2.94v2.65h3.14c1.84-1.7 2.91-4.2 2.91-7.52Z"/><path fill="#34A853" d="M12 21.78c2.62 0 4.82-.87 6.44-2.35l-3.14-2.65c-.87.59-1.99.94-3.3.94-2.54 0-4.69-1.72-5.46-4.03H3.3v2.73A9.73 9.73 0 0 0 12 21.78Z"/><path fill="#FBBC05" d="M6.54 13.69A5.85 5.85 0 0 1 6.24 12c0-.59.1-1.16.3-1.69V7.58H3.3A9.77 9.77 0 0 0 2.27 12c0 1.58.38 3.08 1.03 4.42l3.24-2.73Z"/><path fill="#EA4335" d="M12 6.28c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.82 3.34 14.62 2.22 12 2.22A9.73 9.73 0 0 0 3.3 7.58l3.24 2.73C7.31 8 9.46 6.28 12 6.28Z"/></svg>{label}</a>;
}
