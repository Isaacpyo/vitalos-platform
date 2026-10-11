import { serializeJsonLd } from "../features/seo/json-ld";
import type { JsonLdNode } from "../features/seo/json-ld";

export interface JsonLdProps {
  /** One node or several; null, undefined and empty input render nothing. */
  data: JsonLdNode | readonly (JsonLdNode | null | undefined)[] | null | undefined;
}

/**
 * Emits structured data. `serializeJsonLd` escapes `<` (and the line separators) so content
 * from the CMS can never close the script element.
 */
export function JsonLd({ data }: Readonly<JsonLdProps>) {
  const nodes = (Array.isArray(data) ? data : [data]).filter(
    (node): node is JsonLdNode => node !== null && node !== undefined,
  );
  if (nodes.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(nodes.length === 1 ? nodes[0]! : nodes) }}
    />
  );
}
