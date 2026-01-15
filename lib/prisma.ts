import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withBumpedConnectionLimit(url: string, nextLimit: number): string {
  try {
    const u = new URL(url);
    const current = u.searchParams.get('connection_limit');
    if (current === '1') {
      u.searchParams.set('connection_limit', String(nextLimit));
    }
    if (!u.searchParams.get('pool_timeout')) {
      // Avoid spurious timeouts in dev when multiple requests hit Prisma concurrently.
      u.searchParams.set('pool_timeout', '60');
    }
    return u.toString();
  } catch {
    return url;
  }
}

const isDev = process.env.NODE_ENV !== 'production';

function getDatasourceUrl(): string {
  if (isDev && env.DIRECT_DATABASE_URL) return env.DIRECT_DATABASE_URL;
  if (isDev) return withBumpedConnectionLimit(env.DATABASE_URL, 5);
  return env.DATABASE_URL;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
