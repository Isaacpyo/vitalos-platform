/** Route constants for Insights and Careers, in one place (brief 3.2). */
export const INSIGHTS_BASE = "/insights";
export const CAREERS_BASE = "/careers";
/** The Insights RSS feed, advertised on every page and in the footer (C9). */
export const INSIGHTS_FEED_PATH = `${INSIGHTS_BASE}/feed.xml`;

export const postPath = (slug: string): string => `${INSIGHTS_BASE}/${slug}`;
export const rolePath = (slug: string): string => `${CAREERS_BASE}/${slug}`;
