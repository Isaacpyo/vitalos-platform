import { humanise } from "../institutional/format";

/**
 * Structural labels for insight formats and topics. The values are the Stage 8 §16 names
 * (Formats, Topics), keyed by the slugs the content stores. An unknown value falls back to a
 * readable form of the slug rather than being hidden.
 */
const formatLabels: Readonly<Record<string, string>> = {
  "insight-article": "Insight article",
  "executive-briefing": "Executive briefing",
  "engineering-note": "Engineering note",
  "research-report": "Research report",
  "guide-playbook": "Guide / playbook",
  "case-study-insight": "Case study insight",
  "webinar-event-recap": "Webinar / event recap",
};

const topicLabels: Readonly<Record<string, string>> = {
  "ai-agents": "AI & Agents",
  "digital-transformation": "Digital Transformation",
  "software-platforms": "Software & Platforms",
  "data-analytics": "Data & Analytics",
  "cloud-reliability": "Cloud & Reliability",
  "experience-commerce": "Experience & Commerce",
  "cyber-trust": "Cyber / Trust",
  "health-care": "Health & Care",
  "retail-commerce": "Retail / Commerce",
  "operations-industry-logistics": "Operations / Industry / Logistics",
};

export const formatLabel = (format: string): string => formatLabels[format] ?? humanise(format);
export const topicLabel = (topic: string): string => topicLabels[topic] ?? humanise(topic);

/** Structural headings and field names used by the insight templates. */
export const insightLabels = {
  topic: "Topic",
  authors: "Authors",
  author: "Author",
  related: "Related insights",
  contents: "On this page",
} as const;
