"use client";

import { useEffect } from "react";

export default function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    fetch("/api/site-settings")
      .then(async (r) => {
        const text = await r.text();
        try { return JSON.parse(text); } catch { return {}; }
      })
      .then((data) => {
        if (!data.error) {
          const fontName = data.siteFont === "kay" ? "Kay" : "Foran";
          document.documentElement.style.setProperty("--site-font", `'${fontName}', sans-serif`);
          if (data.bgColor) document.body.style.backgroundColor = data.bgColor;
          if (data.bgPattern) document.body.style.backgroundImage = `url(${data.bgPattern})`;
        }
      })
      .catch(() => {});
  }, []);

  return <>{children}</>;
}
