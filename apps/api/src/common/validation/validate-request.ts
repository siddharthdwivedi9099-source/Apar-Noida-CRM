import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";
import { z } from "zod";

const requestSchema = z.object({
  body: z.any().optional(),
  params: z.any().optional(),
  query: z.any().optional()
});

interface ValidationConfig {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

export function validateRequest(config: ValidationConfig) {
  return (request: Request, _response: Response, next: NextFunction) => {
    requestSchema.parse({
      body: request.body,
      params: request.params,
      query: request.query
    });

    if (config.body) {
      request.body = config.body.parse(request.body);
    }

    if (config.params) {
      request.params = config.params.parse(request.params);
    }

    if (config.query) {
      request.query = config.query.parse(request.query);
    }

    next();
  };
}

