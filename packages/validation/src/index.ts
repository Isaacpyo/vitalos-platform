import { z } from "zod";
export const enquirySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    organisation: z.string().trim().max(160).optional(),
    message: z.string().trim().min(20).max(5000),
    consent: z.literal(true),
  })
  .strict();
export type EnquiryInput = z.infer<typeof enquirySchema>;
