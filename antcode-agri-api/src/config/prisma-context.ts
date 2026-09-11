import { AsyncLocalStorage } from "node:async_hooks";

type RequestPrismaClient = object;

const prismaStorage = new AsyncLocalStorage<RequestPrismaClient>();

export function runWithPrisma<T>(
  client: RequestPrismaClient,
  callback: () => T,
): T {
  return prismaStorage.run(client, callback);
}

export function getRequestPrisma(): RequestPrismaClient | undefined {
  return prismaStorage.getStore();
}