import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Clears the session cookie and redirects to login
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('session');

  return NextResponse.redirect(new URL('/login', request.url));
}
