import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withBumpedConnectionLimit(url: string, minLimit: number): string {
  try {
    const u = new URL(url);
    const current = parseInt(u.searchParams.get('connection_limit') ?? '1', 10);
    // Only raise the limit, never lower it.
    if (current < minLimit) {
      u.searchParams.set('connection_limit', String(minLimit));
    }
    if (!u.searchParams.get('pool_timeout')) {
      // Prevent hanging connections from blocking the pool.
      u.searchParams.set('pool_timeout', '30');
    }
    return u.toString();
  } catch {
    return url;
  }
}

const isDev = process.env.NODE_ENV !== 'production';

function getDatasourceUrl(): string {
  // In dev, prefer the direct (non-pooled) connection if available.
  if (isDev && env.DIRECT_DATABASE_URL) return env.DIRECT_DATABASE_URL;
  if (isDev) return withBumpedConnectionLimit(env.DATABASE_URL, 5);
  // In production, bump to 10 connections per serverless instance.
  // Supabase PgBouncer manages the actual Postgres pool — this controls
  // how many connections each Prisma client can hold open to PgBouncer.
  return withBumpedConnectionLimit(env.DATABASE_URL, 10);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
