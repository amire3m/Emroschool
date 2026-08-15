import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "serwist";
import { Serwist } from "serwist";

interface PushEventLike {
  data?: { json?: () => unknown };
  waitUntil(promise: Promise<unknown>): void;
}

interface NotificationClickEventLike {
  notification: { close(): void; data?: unknown };
  waitUntil(promise: Promise<unknown>): void;
}

interface ServiceWorkerSelf {
  registration: { showNotification(title: string, options: NotificationOptions): Promise<void> };
  clients: {
    matchAll(options: { type: string; includeUncontrolled: boolean }): Promise<Array<{ navigate(url: string): Promise<void>; focus(): Promise<void> }>>;
    openWindow(url: string): Promise<unknown>;
  };
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void;
  addEventListener(type: "notificationclick", listener: (event: NotificationClickEventLike) => void): void;
}

const sw = self as unknown as ServiceWorkerSelf;

const manifest = (self as unknown as { __SW_MANIFEST?: (PrecacheEntry | string)[] | undefined }).__SW_MANIFEST;

const serwist = new Serwist({
  precacheEntries: manifest,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

sw.addEventListener("push", (event) => {
  const data = event.data?.json?.() as { title?: string; body?: string; url?: string } | undefined;
  const url = data?.url || "/";
  const fallbackTitle = "\u0622\u06A9\u0627\u062F\u0645\u06CC \u0627\u0645\u0627\u0645 \u0631\u0648\u062D\u200C\u0627\u0644\u0644\u0647";
  event.waitUntil(
    sw.registration.showNotification(data?.title || fallbackTitle, {
      body: data?.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      dir: "rtl",
      lang: "fa",
      tag: url,
      data: { url },
    }),
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || "/";
  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        await client.navigate(url);
        await client.focus();
        return;
      }
      await sw.clients.openWindow(url);
    })(),
  );
});
