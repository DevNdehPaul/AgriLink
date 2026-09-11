import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";

import {
  globalErrorHandler,
  notFoundHandler,
} from "./common/middleware/error.middleware.js";
import { apiRateLimit } from "./common/middleware/rate-limit.middleware.js";
import { securityLoggingMiddleware } from "./common/middleware/security-logging.middleware.js";
import { corsOrigins, env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
// import { mountSwaggerDocs } from "./docs/swagger.js";

interface CreateAppOptions {
  prismaMiddleware?: RequestHandler;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");

  // mountSwaggerDocs(app);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: env.REQUEST_BODY_LIMIT,
    }),
  );

  app.use(securityLoggingMiddleware);

  if (options.prismaMiddleware) {
    app.use(options.prismaMiddleware);
  }

  app.use("/api/v1", apiRateLimit, apiRouter);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}