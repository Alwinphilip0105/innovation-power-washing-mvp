import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

// Built entirely from build-time config, so it is the same file for every
// request. Saying so explicitly is what lets it be emitted by a static export.
export const dynamic = "force-static";

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
