"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { getCookie } from "@/lib/cookie";
import {
  registerPushSubscription,
  unregisterPushSubscription,
  urlBase64ToUint8Array,
} from "@/lib/push-client";

type PushState = "loading" | "unsupported" | "unconfigured" | "idle" | "busy" | "active" | "error";

function canPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export default function PushManager() {
  const [state, setState] = useState<PushState>("loading");
  const [visible, setVisible] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const publicKeyRef = useRef<string>("");

  useEffect(() => {
    const token = getCookie("token");
    setLoggedIn(Boolean(token));
    if (!token) {
      setVisible(false);
      return;
    }
    if (!canPush()) {
      setState("unsupported");
      setVisible(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/push/config");
        if (!response.ok) throw new Error("config request failed");
        const data: { publicKey?: string | null } = await response.json();
        if (!data.publicKey) {
          if (!cancelled) {
            setState("unconfigured");
            setVisible(false);
          }
          return;
        }
        publicKeyRef.current = data.publicKey;

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          if (!cancelled) setState("active");
        } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          await subscribe(registration, token);
        } else {
          if (!cancelled) setState("idle");
        }
        if (!cancelled) setVisible(true);
      } catch {
        if (!cancelled) {
          setState("error");
          setVisible(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async (registration: ServiceWorkerRegistration, token: string) => {
    if (!publicKeyRef.current) return false;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKeyRef.current),
    });
    const response = await registerPushSubscription(token, subscription);
    if (!response.ok) {
      await subscription.unsubscribe().catch(() => {});
      return false;
    }
    setState("active");
    return true;
  }, []);

  const handleEnable = useCallback(async () => {
    setState("busy");
    const token = getCookie("token");
    if (!token) {
      setState("idle");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState("idle");
          return;
        }
      }
      const ok = await subscribe(registration, token);
      if (!ok) setState("idle");
    } catch {
      setState("error");
    }
  }, [subscribe]);

  const handleDisable = useCallback(async () => {
    setState("busy");
    try {
      const token = getCookie("token");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        if (token) {
          await unregisterPushSubscription(token, subscription.endpoint).catch(() => {});
        }
        await subscription.unsubscribe().catch(() => {});
      }
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  if (!loggedIn || !visible) return null;

  if (state === "active") {
    return (
      <button
        type="button"
        onClick={() => void handleDisable()}
        title="غیرفعال‌سازی اعلان‌ها"
        className="fixed bottom-4 end-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-white shadow-lg hover:bg-primary-container transition-colors"
      >
        <BellOff size={18} className="text-secondary-fixed" />
        <span className="text-xs font-bold">اعلان فعال است</span>
      </button>
    );
  }

  if (state === "busy") {
    return (
      <button
        type="button"
        disabled
        className="fixed bottom-4 end-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-white shadow-lg"
      >
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs font-bold">در حال فعال‌سازی...</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleEnable()}
      className="fixed bottom-4 end-4 z-50 flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-white shadow-lg hover:bg-secondary-container transition-colors"
    >
      <Bell size={18} className="text-secondary-fixed" />
      <span className="text-xs font-bold">فعال‌سازی اعلان</span>
    </button>
  );
}
