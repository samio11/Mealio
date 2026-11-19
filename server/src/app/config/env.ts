import "dotenv/config";
import { z } from "zod";

/** Treat empty strings as "not provided". */
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
  BETTER_AUTH_URL: z.string().default("http://localhost:5000"),

  EMAIL_SENDER_SMTP_HOST: optionalString,
  EMAIL_SENDER_SMTP_PORT: z.coerce.number().int().optional(),
  EMAIL_SENDER_SMTP_USER: optionalString,
  EMAIL_SENDER_SMTP_PASS: optionalString,
  EMAIL_SENDER_SMTP_FROM: optionalString,

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalString,

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  SUPER_ADMIN_EMAIL: optionalString,
  SUPER_ADMIN_PASSWORD: optionalString,

  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  AI_EMBEDDING_MODEL: z.string().default("nvidia/nemotron-3.5-embed-1b:free"),
  AI_TEXT_MODEL: z.string().default("baidu/ernie-5.5-flash-preview:free"),
  GEMINI_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // Fail fast: a misconfigured server must not start.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Feature flags derived from which optional providers are configured. */
export const features = {
  googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  email: Boolean(env.EMAIL_SENDER_SMTP_HOST && env.EMAIL_SENDER_SMTP_USER && env.EMAIL_SENDER_SMTP_PASS),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  ai: Boolean(env.OPENROUTER_API_KEY || env.GROQ_API_KEY || env.GEMINI_API_KEY),
} as const;
