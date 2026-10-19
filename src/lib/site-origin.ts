export function resolveSiteOrigin(value?: string) {
  const url = new URL(value?.trim() || "http://localhost:3000");
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without path, credentials, query or fragment.",
    );
  return url.origin;
}
export function isPublicSiteOrigin(origin: string) {
  const url = new URL(origin);
  return (
    url.protocol === "https:" &&
    !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(
      url.hostname,
    ) &&
    !/\.(localhost|local|test|example|invalid)$/.test(url.hostname) &&
    !/(^|\.)example\.(com|org|net)$/.test(url.hostname) &&
    url.hostname.includes(".")
  );
}
export const siteOrigin = resolveSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
export const publicSiteConfigured = isPublicSiteOrigin(siteOrigin);
