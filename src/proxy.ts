import { NextResponse, type NextRequest } from "next/server";
import { detectLocale } from "./lib/i18n";
import { isLocale } from "./lib/types";
import { contentSecurityPolicy } from "./lib/security-headers";
import { publicSiteConfigured } from "./lib/site-origin";
export function proxy(request: NextRequest) {
  const pathLocale = request.nextUrl.pathname.split("/")[1];
  const nonce=Buffer.from(crypto.randomUUID()).toString("base64");
  const csp=contentSecurityPolicy(nonce,process.env.NODE_ENV==="development",publicSiteConfigured);
  const headers = new Headers(request.headers);
  headers.set("x-nonce",nonce);
  headers.set("Content-Security-Policy",csp);
  headers.set("x-dailygrid-locale",isLocale(pathLocale)?pathLocale:"en");
  if (
    isLocale(pathLocale) || (request.nextUrl.pathname !== "/" && !request.nextUrl.pathname.startsWith("/play/"))
  ) {
    const response=NextResponse.next({request:{headers}});
    response.headers.set("Content-Security-Policy",csp);
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }
  const saved = request.cookies.get("dailygrid-locale")?.value;
  const locale =
    saved && isLocale(saved)
      ? saved
      : detectLocale(request.headers.get("accept-language"));
  const target = request.nextUrl.clone();
  target.pathname =
    request.nextUrl.pathname === "/"
      ? `/${locale}`
      : `/${locale}${request.nextUrl.pathname}`;
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Vary", "Accept-Language, Cookie");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Content-Security-Policy",csp);
  return response;
}
export const config = {
  matcher: ["/((?!api|_next|favicon.svg|sitemap.xml|robots.txt).*)"],
};
