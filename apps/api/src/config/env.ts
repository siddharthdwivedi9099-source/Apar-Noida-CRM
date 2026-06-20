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
  API_CORS_ORIGIN: z.string().default("http://127.0.0.1:5173,http://localhost:5173"),
  DATABASE_ENABLED: booleanish.default(true),
  DATABASE_URL: z.string().default("postgresql://crm:crm@localhost:5433/crm"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DEFAULT_TENANT_SLUG: z.string().default("sample-tenant"),
  DEFAULT_TENANT_NAME: z.string().default("Sample Tenant"),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@sample-tenant.local"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  DEFAULT_ADMIN_FIRST_NAME: z.string().default("Platform"),
  DEFAULT_ADMIN_LAST_NAME: z.string().default("Admin"),
  ENABLE_AUDIT_LOGS: booleanish.default(true),
  JWT_ACCESS_TOKEN_SECRET: z.string().min(16).default("dev-access-secret-change-me"),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(16).default("dev-refresh-secret-change-me"),
  JWT_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  AUTH_ACCOUNT_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
  AUTH_ACCOUNT_LOCK_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_COOKIE_NAME: z.string().default("crm_refresh_token"),
  AUTH_COOKIE_SECURE: booleanish.default(false),
  AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  REDIS_ENABLED: booleanish.default(false),
  REDIS_URL: z.string().default("redis://localhost:6380"),
  AI_GATEWAY_ENABLED: booleanish.default(true),
  AI_DEFAULT_PROVIDER: z.enum(["openai", "anthropic", "azure_openai", "local"]).default("anthropic"),
  AI_DEFAULT_MODEL: z.string().default("claude-opus-4-8"),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  AI_OPENAI_API_KEY: z.string().default(""),
  AI_ANTHROPIC_API_KEY: z.string().default(""),
  AI_AZURE_OPENAI_API_KEY: z.string().default(""),
  AI_AZURE_OPENAI_ENDPOINT: z.string().default(""),
  AI_LOCAL_ENDPOINT: z.string().default(""),
  AI_EMBEDDING_MODEL: z.string().default("text-embedding-3-large"),
  AI_VECTOR_BACKEND: z.string().default("placeholder"),
  API_RATE_LIMIT_ENABLED: booleanish.default(true),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5000),
  SECURITY_PROBE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  AI_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  EXPORT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  FILE_UPLOAD_MAX_MB: z.coerce.number().int().positive().default(25)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Invalid API environment configuration");
}

export const env = parsedEnv.data;
