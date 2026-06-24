import { createRequire } from "node:module";
import pino from "pino";
import { env } from "../../config/env.js";

// Use the pretty transport only in development AND only when pino-pretty is
// actually installed (it is a dev dependency, so production images omit it).
// Falling back to default JSON logging keeps the API bootable in any image.
function resolvePrettyTransport() {
  if (env.NODE_ENV !== "development") {
    return undefined;
  }
  try {
    createRequire(import.meta.url).resolve("pino-pretty");
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard"
      }
    };
  } catch {
    return undefined;
  }
}

// Structured application logger. Every log line carries the service name and
// environment so logs are queryable once shipped to a central aggregator.
// Sensitive fields are redacted defensively so secrets never reach the log sink.
export const logger = pino({
  name: "crm-api",
  level: env.API_LOG_LEVEL,
  base: {
    service: `${env.APP_NAME}-api`,
    environment: env.NODE_ENV
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "authorization",
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
      "token",
      "secret",
      "*.password",
      "*.accessToken",
      "*.refreshToken"
    ],
    censor: "[redacted]"
  },
  transport: resolvePrettyTransport()
});
