import type { Metadata } from "next";
import { headers } from "next/headers";
import { isLocale } from "@/lib/types";
import { siteOrigin } from "@/lib/seo";
import { publicSiteConfigured } from "@/lib/site-origin";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Puzzoria",
  applicationName: "Puzzoria",
  description: "Free puzzle games, daily challenges and unlimited play.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-96.png", type: "image/png", sizes: "96x96" },
    ],
  },
  robots: publicSiteConfigured
    ? { index: true, follow: true }
    : { index: false, follow: true },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const candidate = (await headers()).get("x-dailygrid-locale") ?? "en";
  return (
    <html lang={isLocale(candidate) ? candidate : "en"}>
      <body>{children}</body>
    </html>
  );
}
