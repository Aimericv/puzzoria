import { notFound } from "next/navigation";
import { isLocale } from "@/lib/types";
import { rt } from "@/lib/retention-i18n";
import { pageMetadata } from "@/lib/seo";
import { AccountView } from "@/components/account-view";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    ...pageMetadata(
      locale,
      `${rt(locale).account} | Puzzoria`,
      rt(locale).accountIntro,
      "/account",
    ),
    robots: { index: false, follow: true },
  };
}
export default async function Account({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = rt(locale);
  return (
    <>
      <h1>{m.account}</h1>
      <p className="page-intro limited">{m.accountIntro}</p>
      <AccountView locale={locale} />
    </>
  );
}
