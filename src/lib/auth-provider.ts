export const authCookies = {
  access: 'avopore_access',
  refresh: 'avopore_refresh',
  verifier: 'avopore_pkce',
} as const;

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export function supabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function authCookieOptions(maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' && process.env.AVOPORE_LOCAL_DEMO !== '1';
  return { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge };
}

export function authSessionCookies(session: AuthSession) {
  return [
    { name: authCookies.access, value: session.access_token, options: authCookieOptions(session.expires_in) },
    { name: authCookies.refresh, value: session.refresh_token, options: authCookieOptions(30 * 24 * 60 * 60) },
  ];
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<AuthSession>;
  return typeof session.access_token === 'string' && typeof session.refresh_token === 'string'
    && Number.isInteger(session.expires_in) && (session.expires_in ?? 0) > 0;
}

export async function supabaseAuthRequest(path: string, options?: { body?: unknown; token?: string }) {
  const config = supabaseAuthConfig();
  if (!config) throw new Error('Account sign-in is unavailable.');

  const headers = new Headers({ apikey: config.key });
  if (options?.token) headers.set('Authorization', `Bearer ${options.token}`);
  const isPost = options?.body !== undefined;
  if (isPost) headers.set('Content-Type', 'application/json');

  return fetch(new URL(`/auth/v1${path}`, config.url), {
    method: isPost ? 'POST' : 'GET',
    headers,
    body: isPost ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
}
