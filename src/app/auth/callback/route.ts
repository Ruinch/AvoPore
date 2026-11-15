import { NextRequest, NextResponse } from 'next/server';
import { completeSupabaseSignIn, consumeAuthReturnPath } from '../../../lib/auth';
import { loginPath, safeReturnPath } from '../../../lib/auth-navigation';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeReturnPath(request.nextUrl.searchParams.get('next'));
  const complete = code && await completeSupabaseSignIn(code).catch(() => false);
  if (complete) {
    const savedNext = await consumeAuthReturnPath();
    return NextResponse.redirect(new URL(next ?? savedNext ?? '/discover', request.url));
  }
  return NextResponse.redirect(new URL(loginPath(next ?? '/discover', { error: 'GOOGLE_FAILED' }), request.url));
}
