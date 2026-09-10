/**
 * Represents a controlled/expected application error.
 * Examples: resource not found, insufficient inventory, unauthorized action.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Restore the prototype chain so `instanceof AppError` works correctly.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;

    // Keep stack traces focused on where the error was thrown.
    Error.captureStackTrace?.(this, this.constructor);
  }
}
