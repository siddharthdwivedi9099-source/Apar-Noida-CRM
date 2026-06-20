import pino from "pino";
import { env } from "../../config/env.js";

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
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard"
          }
        }
      : undefined
});
