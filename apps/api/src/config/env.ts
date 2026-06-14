import "dotenv/config";
import { z } from "zod";

const booleanish = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("ai-native-crm"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  API_CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_ENABLED: booleanish.default(false),
  DATABASE_URL: z.string().default("postgresql://crm:crm@localhost:5432/crm"),
  REDIS_ENABLED: booleanish.default(false),
  REDIS_URL: z.string().default("redis://localhost:6379")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Invalid API environment configuration");
}

export const env = parsedEnv.data;
