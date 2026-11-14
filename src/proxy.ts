import { NextRequest, NextResponse } from 'next/server';
import { authCookieOptions, authCookies, authSessionCookies, isAuthSession, supabaseAuthConfig, supabaseAuthRequest } from './lib/auth-provider';

function needsRefresh(accessToken?: string) {
  try {
    const payload = accessToken?.split('.')[1];
    if (!payload) return true;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp !== 'number' || exp <= Date.now() / 1000 + 30;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get(authCookies.refresh)?.value;
  if (!refreshToken || !supabaseAuthConfig() || !needsRefresh(request.cookies.get(authCookies.access)?.value)) {
    return NextResponse.next();
  }

  let response: Response;
  try {
    response = await supabaseAuthRequest('/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } });
  } catch {
    return NextResponse.next();
  }

  if (!response.ok) {
    if (![400, 401, 403].includes(response.status)) return NextResponse.next();
    request.cookies.delete(authCookies.access);
    request.cookies.delete(authCookies.refresh);
    const result = NextResponse.next({ request: { headers: request.headers } });
    result.cookies.set(authCookies.access, '', authCookieOptions(0));
    result.cookies.set(authCookies.refresh, '', authCookieOptions(0));
    result.headers.set('Cache-Control', 'private, no-store');
    return result;
  }

  const session: unknown = await response.json();
  if (!isAuthSession(session)) return NextResponse.next();
  const items = authSessionCookies(session);
  for (const item of items) request.cookies.set(item.name, item.value);

  const result = NextResponse.next({ request: { headers: request.headers } });
  for (const item of items) result.cookies.set(item.name, item.value, item.options);
  result.headers.set('Cache-Control', 'private, no-store');
  return result;
}

export const config = {
  matcher: ['/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
