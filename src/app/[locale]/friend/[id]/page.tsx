import { notFound } from "next/navigation";
import { isLocale } from "@/lib/types";
import { et } from "@/lib/engagement-i18n";
import { viewFriend } from "@/lib/server/friends";
import { FriendPlayer } from "@/components/friend-player";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; id: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const metadata = pageMetadata(
    locale,
    `${et(locale).friendTitle} | Puzzoria`,
    et(locale).friendIntro,
    `/friend/${id}`,
  );
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [`/api/share-image?id=${id}&locale=${locale}`],
    },
    twitter: {
      ...metadata.twitter,
      images: [`/api/share-image?id=${id}&locale=${locale}`],
    },
    robots: { index: false, follow: true },
  };
}
export default async function FriendPage({ params }: Props) {
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
  return (
    <>
      <h1>{et(locale).friendTitle}</h1>
      <p>{et(locale).friendIntro}</p>
      <FriendPlayer initial={view} locale={locale} />
    </>
  );
}
