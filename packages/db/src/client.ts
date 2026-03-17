import { PrismaClient } from "@prisma/client";
import { config } from "@xtanbot/config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: config.DATABASE_URL },
    },
    log: ["warn", "error"],
  });

if (config.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
