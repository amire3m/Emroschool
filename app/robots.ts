import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/mag-admin/", "/api/"] },
    ],
    sitemap: "https://imamruhollahschool.com/sitemap.xml",
  };
}
