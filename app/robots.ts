import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { magazineUrl, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  const isMagazine = hostname === "mag.imamruhollahschool.com" || hostname.startsWith("mag.");

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/mag-admin/", "/api/"] },
    ],
    sitemap: `${isMagazine ? magazineUrl : siteUrl}/sitemap.xml`,
  };
}
