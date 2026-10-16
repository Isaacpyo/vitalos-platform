/** Route constants for Insights and Careers, in one place (brief 3.2). */
export const INSIGHTS_BASE = "/insights";
export const CAREERS_BASE = "/careers";

export const postPath = (slug: string): string => `${INSIGHTS_BASE}/${slug}`;
export const rolePath = (slug: string): string => `${CAREERS_BASE}/${slug}`;
