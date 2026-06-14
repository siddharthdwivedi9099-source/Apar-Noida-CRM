import type { NextFunction, Request, Response } from "express";
import { logger } from "../../platform/logger/logger.js";

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const startedAt = performance.now();

  response.on("finish", () => {
    logger.info(
      {
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Number((performance.now() - startedAt).toFixed(2))
      },
      "HTTP request completed"
    );
  });

  next();
}
