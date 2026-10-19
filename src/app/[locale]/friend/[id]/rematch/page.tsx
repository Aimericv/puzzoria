import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/types";
import { viewFriend } from "@/lib/server/friends";
import { utcDay } from "@/lib/date";
import { canonicalGamePath } from "@/lib/seo";
import { et } from "@/lib/engagement-i18n";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: true } };
export default async function Rematch({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const view = (() => {
    try {
      return viewFriend(id);
    } catch {
      return null;
    }
  })();
  if (!view) notFound();
  const c = view.challenge,
    m = et(locale);
  return (
    <section className="rematch-panel">
      <h1>{m.rematch}</h1>
      <p>{m.rematchHelp}</p>
      {utcDay() <= c.date ? (
        <p>{m.notYet}</p>
      ) : (
        <Link
          className="primary-button"
          href={canonicalGamePath(
            c.kind === "word" || c.kind === "rareword" ? c.locale : locale,
            c.kind,
            undefined,
            c.kind === "sudoku" ? c.difficulty : undefined,
          )}
        >
          {m.nextDaily}
        </Link>
      )}
    </section>
  );
}
