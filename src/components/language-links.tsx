"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { languageNames } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";
import { seoCopy } from "@/lib/seo-content";
import { locales, type Locale } from "@/lib/types";

export function LanguageLinks({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  return (
    <nav className="language-links" aria-label={seoCopy(locale).languages}>
      {locales.map((next) => (
        <Link
          key={next}
          href={localizedPath(pathname, locale, next)}
          hrefLang={next}
          lang={next}
          aria-current={locale === next ? "page" : undefined}
        >
          {languageNames[next]}
        </Link>
      ))}
    </nav>
  );
}
