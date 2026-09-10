import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

/** Starts the database connection first, then begins accepting HTTP traffic. */
async function startServer(): Promise<void> {
  try {
    // Fail during startup if PostgreSQL cannot be reached.
    await prisma.$connect();
    console.log("Database connection established");

    const server = app.listen(env.PORT, () => {
      console.log(`AntCode Agri API running on http://localhost:${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });

    /**
     * Gracefully stop accepting requests and close database connections.
     * SIGINT handles Ctrl+C; SIGTERM is commonly used by hosting platforms.
     */
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      const forceExit = setTimeout(() => {
        console.error("Graceful shutdown timed out; forcing exit");
        process.exit(1);
      }, 10_000);
      forceExit.unref();

      server.close(async () => {
        try {
          clearTimeout(forceExit);
          await prisma.$disconnect();
          console.log("Database connection closed");
          console.log("Server stopped");
          process.exit(0);
        } catch (error) {
          console.error("Error while shutting down the server:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start AntCode Agri API:", error);

    // Best-effort cleanup if startup fails after Prisma was initialized.
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
}

void startServer();
