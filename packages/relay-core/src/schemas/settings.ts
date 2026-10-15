import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");
const origin = z
  .string()
  .regex(/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i, "must be an origin such as https://vitalos.co.uk");

export const DEFAULT_SUGGESTED_QUESTIONS = [
  "What does an AI Opportunity Assessment involve?",
  "Can you take over a struggling software project?",
  "How does an engagement with Vitalos start?",
  "Which sectors do you work in?",
] as const;

export const DEFAULT_GREETING =
  "I'm Relay, the Vitalos AI assistant. I answer from our published knowledge and show my sources. A person from the team is one message away.";

export const DEFAULT_OUT_OF_HOURS =
  "The team is offline right now. We'll reply by email on the next working day.";

/**
 * Relay settings (single row `relay.settings.config`). Every field has a default, so an empty
 * object parses to a complete configuration and new fields never break stored rows.
 */
export const relaySettingsSchema = z
  .object({
    aiEnabled: z.boolean().default(true),
    model: z
      .string()
      .min(1)
      .max(80)
      .refine((m) => m !== "deepseek-chat" && m !== "deepseek-reasoner", {
        message: "deepseek-chat and deepseek-reasoner were retired on 24 July 2026",
      })
      .default("deepseek-flash"),
    businessHours: z
      .object({
        days: z.array(z.number().int().min(0).max(6)).max(7).default([1, 2, 3, 4, 5]),
        start: hhmm.default("09:00"),
        end: hhmm.default("17:30"),
        timezone: z.literal("Europe/London").default("Europe/London"),
      })
      .default({ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:30", timezone: "Europe/London" }),
    outOfHoursText: z.string().min(1).max(300).default(DEFAULT_OUT_OF_HOURS),
    reminderMinutes: z.number().int().min(2).max(120).default(10),
    secondReminderMinutes: z.number().int().min(5).max(240).default(30),
    emailSnippet: z.boolean().default(true),
    visitorEmailsEnabled: z.boolean().default(false),
    greeting: z.string().min(1).max(400).default(DEFAULT_GREETING),
    suggestedQuestions: z
      .array(z.string().min(3).max(120))
      .max(4)
      .default([...DEFAULT_SUGGESTED_QUESTIONS]),
    confidenceThreshold: z.number().min(0).max(1).default(0.4),
    dailyTokenCap: z.number().int().min(10_000).max(100_000_000).default(2_000_000),
    retention: z
      .object({
        noContactDays: z.number().int().min(7).max(730).default(90),
        withContactDays: z.number().int().min(30).max(1095).default(365),
      })
      .default({ noContactDays: 90, withContactDays: 365 }),
    allowedOrigins: z.array(origin).max(10).default([]),
  })
  .refine((s) => s.secondReminderMinutes > s.reminderMinutes, {
    message: "the second reminder must come after the first",
    path: ["secondReminderMinutes"],
  })
  .refine((s) => s.businessHours.start < s.businessHours.end, {
    message: "business hours must end after they start",
    path: ["businessHours", "end"],
  });

export type RelaySettings = z.infer<typeof relaySettingsSchema>;

/** Parses stored config; anything invalid falls back to defaults field by field. */
export function parseStoredSettings(raw: unknown): RelaySettings {
  const parsed = relaySettingsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return relaySettingsSchema.parse({});
}
