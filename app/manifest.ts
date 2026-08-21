import type { MetadataRoute } from "next";
import { siteName } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteName,
    short_name: "آکادمی امام روح‌الله",
    description: "آموزش هنر و رسانه در تراز انقلاب اسلامی - آکادمی امام روح‌الله",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#03004b",
    theme_color: "#03004b",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/icons/screenshot-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide" },
      { src: "/icons/screenshot-narrow.png", sizes: "640x1136", type: "image/png", form_factor: "narrow" },
    ] as unknown as MetadataRoute.Manifest["screenshots"],
    shortcuts: [
      {
        name: "دوره‌ها",
        short_name: "دوره‌ها",
        url: "/courses",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "داشبورد",
        short_name: "داشبورد",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
