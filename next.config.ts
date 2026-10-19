import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";
import { publicSiteConfigured } from "./src/lib/site-origin";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  headers: () => [
    {source:"/:path*",headers:[...securityHeaders,...(publicSiteConfigured ? [{key:"Strict-Transport-Security",value:"max-age=31536000"}] : [])]},
    {
      source: "/api/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    },
  ],
  outputFileTracingExcludes: {
    "/*": [
      "./.data/**/*",
      "./.sites-runtime/**/*",
      "./.next-e2e/**/*",
      "./test-results/**/*",
      "./playwright-report/**/*",
    ],
  },
  ...(process.env.NEXT_TEST_DIST_DIR
    ? { distDir: process.env.NEXT_TEST_DIST_DIR }
    : {}),
};
export default config;
