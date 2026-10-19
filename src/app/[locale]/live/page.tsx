import { notFound } from "next/navigation";
import { isLocale } from "@/lib/types";
import { lt } from "@/lib/live-i18n";
import { pageMetadata } from "@/lib/seo";
import { LiveCreate } from "@/components/live-room";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const p = await params;
  if (!isLocale(p.locale)) notFound();
  return {
    ...pageMetadata(
      p.locale,
      lt(p.locale).title + " | Puzzoria",
      lt(p.locale).waitingReady,
      "/live",
    ),
    robots: { index: false, follow: true },
  };
}
export default async function Page({ params }: Props) {
  const p = await params;
  if (!isLocale(p.locale)) notFound();
  return <LiveCreate locale={p.locale} />;
}
