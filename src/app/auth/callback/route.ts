import { NextRequest, NextResponse } from 'next/server';
import { completeSupabaseSignIn } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const complete = code && await completeSupabaseSignIn(code).catch(() => false);
  return NextResponse.redirect(new URL(complete ? '/discover' : '/login?error=GOOGLE_FAILED', request.url));
}
