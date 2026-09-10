import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

/** Mount interactive Swagger UI and the raw OpenAPI JSON document. */
export function mountSwaggerDocs(app: Express): void {
  app.get("/docs/openapi.json", (_req: Request, res: Response) => {
    res.status(200).json(openApiDocument);
  });

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "AntCode Agri API - Swagger UI",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: "alpha",
        operationsSorter: "method",
      },
    }),
  );
}
