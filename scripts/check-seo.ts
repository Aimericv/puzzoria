import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { siteOrigin, publicSiteConfigured } = await import(
  "../src/lib/site-origin"
);
if (!publicSiteConfigured) {
  console.error(
    "SEO : définissez NEXT_PUBLIC_SITE_URL avec le domaine HTTPS public définitif. La configuration actuelle reste en noindex.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `SEO : domaine configuré ${siteOrigin}. Canonicals, hreflang et sitemap utilisent cette origine. Vérifiez encore le site déployé et Search Console (docs/SEO.fr.md).`,
  );
}
