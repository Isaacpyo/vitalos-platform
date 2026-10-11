/**
 * A redirect rule. `status` follows the Sanity `redirect` document: 301 or 308 redirect to
 * `destination`; 410 marks a path as permanently gone and has no destination.
 */
export type RedirectRule =
  | { source: string; destination: string; status: 301 | 308 }
  | { source: string; destination?: undefined; status: 410 };

export type GoneRule = Extract<RedirectRule, { status: 410 }>;
export type MovedRule = Exclude<RedirectRule, GoneRule>;
