import { NextRequest, NextResponse } from 'next/server';
import { completeSupabaseEmailVerification, consumeAuthReturnPath } from '../../../lib/auth';
import { emailReturnPath, loginPath } from '../../../lib/auth-navigation';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const next = emailReturnPath(request.nextUrl.searchParams.get('next'), request.nextUrl.origin);
  const complete = tokenHash && await completeSupabaseEmailVerification(tokenHash).catch(() => false);
  if (complete) {
    const savedNext = await consumeAuthReturnPath();
    return NextResponse.redirect(new URL(next ?? savedNext ?? '/discover', request.url));
  }
  return NextResponse.redirect(new URL(loginPath(next ?? '/discover', { mode: 'signup', error: 'SIGN_UP_FAILED' }), request.url));
}
