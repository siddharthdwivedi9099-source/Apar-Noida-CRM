import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./platform/logger/logger.js";

const app = createApp();

app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(
    {
      host: env.API_HOST,
      port: env.API_PORT
    },
    "API server is running"
  );
});

