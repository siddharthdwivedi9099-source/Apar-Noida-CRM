import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

export function notFoundHandler(request: Request, _response: Response, next: NextFunction) {
  next(new AppError(404, `Route not found: ${request.method} ${request.originalUrl}`));
}

