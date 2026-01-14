import { NextResponse } from 'next/server';

export async function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    null;

  const ref =
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
    null;

  const env =
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.NODE_ENV ||
    null;

  const deploymentUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || null;

  const res = NextResponse.json({
    sha,
    ref,
    env,
    deploymentUrl,
    serverTime: new Date().toISOString(),
  });

  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
