import "server-only";
import { z } from "zod";
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
});
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SANITY_PROJECT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_SANITY_DATASET: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .default("development"),
});
export const readServerEnv = (env: NodeJS.ProcessEnv = process.env) => serverSchema.parse(env);
export const readPublicEnv = (env: NodeJS.ProcessEnv = process.env) => publicSchema.parse(env);
