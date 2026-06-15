export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
    public readonly code = "APP_ERROR"
  ) {
    super(message);
    this.name = code;
  }
}
