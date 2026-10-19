import { notFound } from "next/navigation";
import { isLocale } from "@/lib/types";
import { pageMetadata } from "@/lib/seo";
import { lt } from "@/lib/live-i18n";
import { LiveRoom } from "@/components/live-room";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; code: string }> };
export async function generateMetadata({ params }: Props) {
  const p = await params;
  if (!isLocale(p.locale) || !/^[A-Za-z0-9_-]{43}$/.test(p.code)) notFound();
  return {
    ...pageMetadata(
      p.locale,
      lt(p.locale).title + " | Puzzoria",
      lt(p.locale).waitingReady,
      "/live/" + p.code,
    ),
    robots: { index: false, follow: true },
    referrer: "same-origin",
  };
}
export default async function Page({ params }: Props) {
  const p = await params;
  if (!isLocale(p.locale) || !/^[A-Za-z0-9_-]{43}$/.test(p.code)) notFound();
  return <LiveRoom locale={p.locale} code={p.code} />;
}
