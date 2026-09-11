import type { PrismaClient } from "../generated/prisma-node/client.js";
import { getRequestPrisma } from "./prisma-context.js";

type PrismaClientInstance = object;

let defaultPrisma: PrismaClientInstance | undefined;

/**
 * Registers the default Prisma client for runtimes that maintain
 * a long-lived database client, such as the normal Node.js server.
 */
export function setDefaultPrisma(client: PrismaClientInstance): void {
  defaultPrisma = client;
}

/**
 * Resolves the Prisma client for the current execution context.
 *
 * Cloudflare requests receive a request-scoped client through
 * AsyncLocalStorage.
 *
 * Node.js falls back to the client registered during server startup.
 */
function currentPrisma(): PrismaClientInstance {
  const requestPrisma = getRequestPrisma();

  if (requestPrisma) {
    return requestPrisma;
  }

  if (defaultPrisma) {
    return defaultPrisma;
  }

  throw new Error(
    "Prisma client is not available in the current execution context.",
  );
}

/**
 * Runtime-neutral Prisma bridge.
 *
 * The Node Prisma client is imported as a TYPE ONLY so services retain
 * full Prisma type safety without including the Node Prisma runtime
 * in the Cloudflare Worker bundle.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = currentPrisma();
    const value = Reflect.get(client, property, client);

    return typeof value === "function"
      ? value.bind(client)
      : value;
  },
});