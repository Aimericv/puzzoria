import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Google must crawl HTML pages to see their noindex directive.
      // The game API also provides resources used by rendered pages.
      disallow: [],
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
