import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/types";
import { st } from "@/lib/social-i18n";
import { pageMetadata } from "@/lib/seo";
import { NumberRoom } from "@/components/number-room";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; code: string }> };
export async function generateMetadata({ params }: Props) {
  const p = await params;
  if (!isLocale(p.locale) || !/^[A-Z2-9]{8}$/.test(p.code)) notFound();
  const m = st(p.locale);
  return {
    ...pageMetadata(
      p.locale,
      m.guessName + " · " + m.friends + " | Puzzoria",
      m.guessDesc,
      "/number-room/" + p.code,
    ),
    robots: { index: false, follow: true },
  };
}
export default async function Page({ params }: Props) {
  const p = await params;
  if (!isLocale(p.locale) || !/^[A-Z2-9]{8}$/.test(p.code)) notFound();
  const m = st(p.locale);
  return (
    <>
      <Link className="back-link" href={`/${p.locale}`}>
        ← Puzzoria
      </Link>
      <h1>
        {m.guessName} · {m.friends}
      </h1>
      <section className="play-surface guess">
        <NumberRoom locale={p.locale} initialCode={p.code} />
      </section>
      <p>{m.guessRules}</p>
    </>
  );
}
