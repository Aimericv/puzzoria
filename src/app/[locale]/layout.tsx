import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { isLocale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { WebMCP } from "@/components/webmcp";
import { AccountProvider } from "@/components/account-provider";
import { LanguageLinks } from "@/components/language-links";
import { MeasurementProvider } from "@/components/measurement-provider";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = t(locale);
  return (
    <AccountProvider locale={locale}>
      <Header locale={locale} />
      <WebMCP locale={locale} />
      <MeasurementProvider locale={locale} />
      <main className="page-container">{children}</main>
      <footer className="site-footer">
        <div>
          <Link className="footer-brand" href={`/${locale}`}>
            puzzoria.
          </Link>
          <span>{m.footer}</span>
        </div>
        <div>
          <span>{m.timezone}</span>
          <Link href={`/${locale}/privacy`}>{m.privacy}</Link>
          <CookieSettingsButton locale={locale} />
        </div>
        <LanguageLinks locale={locale} />
      </footer>
    </AccountProvider>
  );
}
