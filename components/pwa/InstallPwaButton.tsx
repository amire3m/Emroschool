"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<"loading" | "ready" | "installed" | "unsupported">("loading");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallState("ready");
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setInstallState("installed");
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    // Check if already installed (display-mode: standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstallState("installed");
    } else if (/iP(hone|ad|od)/i.test(navigator.userAgent)) {
      setInstallState("unsupported");
    }
    // Otherwise keep "loading" and wait for beforeinstallprompt.

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallState("installed");
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  if (installState === "installed") return null;
  if (installState === "loading") return null;

  return (
    <div className="space-y-4">
      {installState === "ready" && (
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-bold text-white shadow-lg transition-colors hover:bg-primary-container disabled:opacity-60"
        >
          {installing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          نصب اپلیکیشن
        </button>
      )}
      {installState === "unsupported" && (
        <div className="rounded-2xl border border-secondary/30 bg-[#fffaf0] p-5 text-right">
          <p className="text-sm font-bold text-primary">نصب با سافاری آیفون</p>
          <ol className="mt-3 space-y-2 text-xs leading-6 text-outline" dir="rtl">
            <li>۱. دکمه <strong>Share</strong> (📤) را در نوار پایین سافاری بزنید.</li>
            <li>۲. به پایین اسکرول کنید و <strong>Add to Home Screen</strong> (افزودن به صفحه اصلی) را انتخاب کنید.</li>
            <li>۳. در پنجره باز شده، <strong>Add</strong> را بزنید.</li>
          </ol>
        </div>
      )}
    </div>
  );
}