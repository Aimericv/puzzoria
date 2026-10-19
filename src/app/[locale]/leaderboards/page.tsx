import { notFound } from "next/navigation";
import { isLocale } from "@/lib/types";
import { rt } from "@/lib/retention-i18n";
import { pageMetadata } from "@/lib/seo";
import { LeaderboardView } from "@/components/leaderboard-view";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    ...pageMetadata(
      locale,
      `${rt(locale).leaderboards} | Puzzoria`,
      rt(locale).boardIntro,
      "/leaderboards",
    ),
    robots: { index: false, follow: true },
  };
}
export default async function Leaderboards({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = rt(locale);
  return (
    <>
      <h1>{m.leaderboards}</h1>
      <p className="page-intro limited">{m.boardIntro}</p>
      <LeaderboardView locale={locale} />
    </>
  );
}
