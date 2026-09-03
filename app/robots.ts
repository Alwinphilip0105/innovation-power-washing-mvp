import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The dashboard, sign-in and API surface are not for crawlers.
        disallow: ["/dashboard", "/dashboard/", "/login", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
