/**
 * Crawler policy (docs/seo/DECISIONS.md 10). One place decides which crawlers may read the
 * production site; robots.txt is generated from it (`robots-policy.ts`).
 *
 * Tokens are the robots.txt product tokens each vendor documents (checked 16 Oct 2026):
 *  - search engines: Googlebot, Bingbot, Applebot;
 *  - AI search and assistant agents, which fetch pages to cite them in answers: OpenAI
 *    (OAI-SearchBot, ChatGPT-User), Anthropic (Claude-SearchBot, Claude-User), Perplexity
 *    (PerplexityBot, Perplexity-User). OpenAI and Perplexity say robots.txt may not apply to
 *    their user-initiated agents, so those rules state intent rather than guarantee it;
 *  - AI training crawlers and opt-out tokens: GPTBot (OpenAI), ClaudeBot (Anthropic),
 *    Google-Extended (Gemini training and grounding; not Search), Applebot-Extended (Apple
 *    training; not Search), CCBot (Common Crawl), meta-externalagent (Meta).
 *
 * Search and assistant agents are always allowed: they are how Vitalos appears in AI answers.
 */

export const searchEngineAgents = ["Googlebot", "Bingbot", "Applebot"] as const;

export const aiAssistantAgents = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
] as const;

export const aiTrainingAgents = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
] as const;

/**
 * THE FLAG. `true` lets AI training crawlers read the site (the default the owner was given);
 * `false` sends them `Disallow: /`. Changing it changes robots.txt on the next deploy; vendors
 * say they pick up robots.txt changes within about 24 hours. It is on the owner approval list.
 */
export const allowAiTraining = true;

/** Paths no crawler needs: endpoints, not pages. Preview and draft routes all live under /api. */
export const disallowedPaths = ["/api/"] as const;
