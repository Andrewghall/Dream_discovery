import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await request;
  await params;

  return NextResponse.json(
    {
      error: 'Zoom integration disabled',
      detail: 'This project is configured to capture local room audio and does not use the Zoom SDK.',
    },
    { status: 410 }
  );
}
