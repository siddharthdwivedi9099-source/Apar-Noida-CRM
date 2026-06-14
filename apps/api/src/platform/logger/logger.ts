import pino from "pino";
import { env } from "../../config/env.js";

export const logger = pino({
  name: "crm-api",
  level: env.API_LOG_LEVEL,
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

