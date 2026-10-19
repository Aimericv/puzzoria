import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isLocale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { rt } from "@/lib/retention-i18n";
import { siteAnalyticsCopy } from "@/lib/site-analytics-i18n";
import { MeasurementPreferences } from "@/components/measurement-provider";
import { legalCopy } from "@/lib/legal-i18n";
import { legalDetails, missingLegalDetails } from "@/lib/server/legal";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(
    locale,
    `${t(locale).privacy} | Puzzoria`,
    legalCopy(locale).description,
    "/privacy",
  );
}
export default async function Privacy({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = t(locale);
  const copy = legalCopy(locale), legal = legalDetails();
  return (
    <>
      <span className="eyebrow">
        <ShieldCheck size={16} />
        {m.privacy}
      </span>
      <h1>{m.privacyTitle}</h1>
      <p className="page-intro limited">{rt(locale).privacy}</p>
      <p className="limited">{siteAnalyticsCopy(locale).privacyPublic}</p>
      <div className="legal-sections limited">
        <section><h2>{copy.publisher}</h2>
          {missingLegalDetails().length > 0 && <p>{copy.pending}</p>}
          {legal.publisher && <p>{legal.publisher}<br />{legal.address}<br />{legal.country}</p>}
          {legal.email && <p>{copy.contact} : <a href={`mailto:${legal.email}`}>{legal.email}</a></p>}
          {legal.host && <p>{copy.hosting} : {legal.host}<br />{legal.hostAddress}<br />{legal.storageRegion}</p>}
        </section>
        {(["purposes", "measure", "retention", "rights"] as const).map(key => <section key={key}><h2>{copy[key]}</h2><p>{copy[`${key}Text`]}</p></section>)}
      </div>
      <MeasurementPreferences locale={locale}/>
    </>
  );
}
