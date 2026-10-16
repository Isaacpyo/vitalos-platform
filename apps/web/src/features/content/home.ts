import "server-only";
import type { HomeData } from "./schemas";
import { getContentReaders } from "./server";

/**
 * The homepage's Insights and Careers sections (brief 5.6, 6.5) from the cached `home` read
 * (tag `home`). Fail-soft: not configured, missing or any failure leaves both sections out, so
 * the homepage never errors because of the admin (ADR-040).
 */
export async function loadHomeSections(
  readers: Pick<ReturnType<typeof getContentReaders>, "home"> = getContentReaders(),
): Promise<HomeData | null> {
  try {
    const result = await readers.home();
    return result.kind === "ok" ? result.data : null;
  } catch {
    return null;
  }
}
