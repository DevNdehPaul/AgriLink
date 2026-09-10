import cors from "cors";
import express from "express";
import helmet from "helmet";
import { globalErrorHandler, notFoundHandler } from "./common/middleware/error.middleware.js";
import { apiRateLimit } from "./common/middleware/rate-limit.middleware.js";
import { securityLoggingMiddleware } from "./common/middleware/security-logging.middleware.js";
import { corsOrigins, env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { mountSwaggerDocs } from "./docs/swagger.js";

/** Express configuration is separate from server startup for testability. */
export const app = express();

// Hosting platforms commonly place Express behind one trusted reverse proxy.
// This lets req.ip and HTTPS-aware behavior use the forwarded client values.
if (env.NODE_ENV === "production") app.set("trust proxy", 1);
app.disable("x-powered-by");

// Interactive OpenAPI documentation. Kept outside /api/v1 so browsing the
// documentation does not consume the application API rate-limit budget.
mountSwaggerDocs(app);

// Security headers. Cross-origin-resource-policy is relaxed because the API is
// intentionally consumed by the separately hosted Angular frontend.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Browser clients may call the API only from explicitly configured origins.
// Requests without Origin (PowerShell, mobile/server clients) remain valid.
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

// Keep payloads intentionally small; this API does not accept file uploads.
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

app.use(securityLoggingMiddleware);
app.use("/api/v1", apiRateLimit, apiRouter);

app.use(notFoundHandler);
app.use(globalErrorHandler);
