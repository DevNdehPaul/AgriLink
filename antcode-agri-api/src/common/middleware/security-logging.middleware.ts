import type { NextFunction, Request, Response } from "express";

/** Logs only security-relevant failures; never logs tokens, passwords or bodies. */
export function securityLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn("Security event", {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ip: req.ip,
        userId: req.user?.id ?? null,
        durationMs: Date.now() - startedAt,
      });
    }
  });

  next();
}
