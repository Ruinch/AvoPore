import { NextRequest, NextResponse } from 'next/server';
import { completeSupabaseEmailVerification } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const complete = tokenHash && await completeSupabaseEmailVerification(tokenHash).catch(() => false);
  return NextResponse.redirect(new URL(complete ? '/discover' : '/login?mode=signup&error=SIGN_UP_FAILED', request.url));
}
