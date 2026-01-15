import { z } from 'zod';

const fromEmailSchema = z.string().trim().refine(
  (value) => {
    if (z.string().email().safeParse(value).success) return true;
    const m = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
    if (!m) return false;
    return z.string().email().safeParse(m[1]).success;
  },
  { message: 'Invalid email address' }
);

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: fromEmailSchema.optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  ZOOM_VIDEO_SDK_KEY: z.string().optional(),
  ZOOM_VIDEO_SDK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
