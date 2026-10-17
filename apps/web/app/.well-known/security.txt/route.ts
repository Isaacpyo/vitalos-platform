import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { getSeoContext } from "../../../src/features/seo/context";
import { buildSecurityTxt } from "../../../src/features/security-txt/security-txt";

/**
 * `/.well-known/security.txt` (RFC 9116; finding B8). Regenerated daily so `Expires` always stays
 * about a year ahead; the Security topic of the Trust Centre links to it.
 */
export const revalidate = 86_400;

export async function GET(): Promise<Response> {
  const { settings } = await loadChromeContent();
  const body = buildSecurityTxt({
    siteUrl: getSeoContext().siteUrl,
    contactEmail: settings.securityEmail ?? settings.contactEmail,
    now: new Date(),
  });
  if (body === null) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
