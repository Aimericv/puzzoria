import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { isLocale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { StatsView } from "@/components/stats-view";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    ...pageMetadata(
      locale,
      `${t(locale).stats} | Puzzoria`,
      t(locale).statsIntro,
      "/stats",
    ),
    robots: { index: false, follow: true },
  };
}
export default async function Stats({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = t(locale);
  return (
    <>
      <span className="eyebrow">
        <BarChart3 size={16} />
        {m.stats}
      </span>
      <h1>{m.statsTitle}</h1>
      <p className="page-intro">{m.statsIntro}</p>
      <StatsView locale={locale} />
    </>
  );
}
