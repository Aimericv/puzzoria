import { jsonLd } from "@/lib/structured-data";
import { headers } from "next/headers";
export async function StructuredData({ value }: { value: unknown }) {
  const nonce=(await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: jsonLd(value) }}
    />
  );
}
