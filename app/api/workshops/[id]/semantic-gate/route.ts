// @deprecated — replaced by EthentaFlow deterministic scoring (Phase 1).
// This endpoint is no longer called. Safe to delete this file and directory.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ removed: true }, { status: 410 });
}
