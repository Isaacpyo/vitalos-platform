/**
 * The founder, as the published Insights author profile states it (approved source: the author
 * page https://vitalos.co.uk/insights/authors/temitope-agbola and the byline of "Strategy that
 * gets engineered: introducing Vitalos", read 17 Oct 2026). Name, role and bio are copied verbatim;
 * nothing is added. Shown on About only while ABOUT_FOUNDER_ENABLED is on (ADR-045): publishing
 * the section is an owner approval. When the profile changes in the Super Admin, change this too.
 */
export const founderProfile = {
  name: "Temitope Agbola",
  /** The profile's role line is "Founder, Vitalos". */
  role: "Founder",
  bio: "Temitope Agbola is the founder of Vitalos, a UK technology consulting, engineering and digital transformation firm. Vitalos helps ambitious organisations modernise operations, build digital products and adopt AI, taking work from strategy to production. Temitope writes about turning technology strategy into systems that ship, run and earn their keep.",
  /** The Insights author page, linked while the Insights section is open. */
  authorSlug: "temitope-agbola",
} as const;
