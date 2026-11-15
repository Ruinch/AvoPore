import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { authCookieOptions, authCookies, authSessionCookies, isAuthSession, supabaseAuthConfig, supabaseAuthRequest } from './auth-provider';
import { authCallbackUrl, safeReturnPath } from './auth-navigation';
import { isLocalDemo, query } from './db';

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'studio_owner' | 'studio_staff' | 'admin';
  studioId: string | null;
};

const demoCookie = 'avopore_demo_session';
const demoDuration = 7 * 24 * 60 * 60;
const demoUsers = {
  member: '00000000-0000-4000-8000-000000000001',
  studio: '00000000-0000-4000-8000-000000000002',
  admin: '00000000-0000-4000-8000-000000000003',
} as const;
const hashPassword = promisify(scrypt);
const localState = globalThis as typeof globalThis & { avoporeSessionKey?: Buffer };

function demoSignature(payload: string) {
  const secret = process.env.AVOPORE_DEMO_SESSION_SECRET || (localState.avoporeSessionKey ??= randomBytes(32));
  return createHmac('sha256', secret).update(payload).digest();
}

async function rememberDemoUser(id: string) {
  const payload = `${id}.${Math.floor(Date.now() / 1000) + demoDuration}`;
  (await cookies()).set(demoCookie, `${payload}.${demoSignature(payload).toString('hex')}`, authCookieOptions(demoDuration));
}

function readDemoId(value?: string) {
  const [id, expires, signature, extra] = value?.split('.') ?? [];
  if (!id || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
    || !expires || !/^\d+$/.test(expires) || Number(expires) <= Date.now() / 1000
    || !signature || !/^[0-9a-f]{64}$/i.test(signature) || extra !== undefined) return null;

  return timingSafeEqual(demoSignature(`${id}.${expires}`), Buffer.from(signature, 'hex')) ? id : null;
}

async function getProfile(id: string) {
  const [profile] = await query<AppUser>(`
    SELECT id, email, full_name AS name, role, studio_id AS "studioId"
    FROM public.profiles WHERE id = $1
  `, [id]);
  return profile ?? null;
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<AppUser | null> {
  const jar = await cookies();
  if (isLocalDemo()) {
    const id = readDemoId(jar.get(demoCookie)?.value);
    return id ? getProfile(id) : null;
  }

  const token = jar.get(authCookies.access)?.value;
  if (!token || !supabaseAuthConfig()) return null;
  const response = await supabaseAuthRequest('/user', { token });
  if (!response.ok) return null;
  const user: { id?: unknown } = await response.json();
  return typeof user.id === 'string' ? getProfile(user.id) : null;
});

export async function requireUser(role?: AppUser['role'] | 'studio'): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const matchesStudio = role === 'studio' && (user.role === 'studio_owner' || user.role === 'studio_staff');
  if (role && user.role !== role && !matchesStudio) redirect('/');
  return user;
}

export function resolveAppOrigin(origin: string) {
  const configured = process.env.APP_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`);
  const url = new URL(configured || origin);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
    throw new Error('Account access requires a configured application URL.');
  }
  if (process.env.NODE_ENV === 'production' && !configured && !loopback) {
    throw new Error('Set APP_URL to your public application URL.');
  }
  return url.origin;
}

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  return normalized;
}

async function rememberSupabaseSession(value: unknown) {
  if (!isAuthSession(value)) return false;
  const jar = await cookies();
  for (const item of authSessionCookies(value)) jar.set(item.name, item.value, item.options);
  return true;
}

async function createPkce(next: string) {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const jar = await cookies();
  const options = authCookieOptions(30 * 60);
  jar.set(authCookies.verifier, verifier, options);
  jar.set(authCookies.returnPath, safeReturnPath(next) ?? '/discover', options);
  return { code_challenge: challenge, code_challenge_method: 's256' } as const;
}

export async function consumeAuthReturnPath() {
  const jar = await cookies();
  const next = safeReturnPath(jar.get(authCookies.returnPath)?.value);
  jar.set(authCookies.returnPath, '', authCookieOptions(0));
  return next;
}

export async function signIn(email: string, password: string) {
  const address = normalizeEmail(email);
  if (!password || password.length > 128) throw new Error('Enter your password.');
  const message = 'We couldn’t sign you in. Check your email and password.';

  if (isLocalDemo()) {
    const [account] = await query<{ id: string; password_hash: string }>(`
      SELECT p.id, c.password_hash FROM public.profiles p
      JOIN public.demo_credentials c ON c.user_id = p.id WHERE p.email = $1
    `, [address]);
    const [salt, expected] = account?.password_hash.split(':') ?? [];
    const derived = await hashPassword(password, salt ?? 'unused-demo-credential', 64) as Buffer;
    if (!account || !expected || !/^[0-9a-f]{128}$/i.test(expected)
      || !timingSafeEqual(derived, Buffer.from(expected, 'hex'))) throw new Error(message);
    return rememberDemoUser(account.id);
  }

  const response = await supabaseAuthRequest('/token?grant_type=password', { body: { email: address, password } });
  if (!response.ok || !await rememberSupabaseSession(await response.json())) throw new Error(message);
}

export async function signUp(email: string, password: string, name: string, origin: string, next: string): Promise<'signed-in' | 'confirm-email'> {
  const address = normalizeEmail(email);
  const fullName = name.trim();
  if (!fullName || fullName.length > 80) throw new Error('Enter a name between 1 and 80 characters.');
  if (password.length < 8 || password.length > 128) throw new Error('Use a password between 8 and 128 characters.');

  if (isLocalDemo()) {
    const id = randomUUID();
    const salt = randomBytes(16).toString('hex');
    const derived = await hashPassword(password, salt, 64) as Buffer;
    const [account] = await query<{ user_id: string }>(`
      WITH demo_user AS (
        INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (email) DO NOTHING RETURNING id
      )
      INSERT INTO public.demo_credentials (user_id, password_hash)
      SELECT id, $4 FROM demo_user RETURNING user_id
    `, [id, address, JSON.stringify({ full_name: fullName }), `${salt}:${derived.toString('hex')}`]);
    if (!account) throw new Error('This email already has an account. Try signing in.');
    await rememberDemoUser(account.user_id);
    return 'signed-in';
  }

  const callback = authCallbackUrl(resolveAppOrigin(origin), next);
  const response = await supabaseAuthRequest(`/signup?${new URLSearchParams({ redirect_to: callback })}`, {
    body: { email: address, password, data: { full_name: fullName }, ...await createPkce(next) },
  });
  if (!response.ok) throw new Error('We couldn’t create your account. Check your details and try again.');
  return await rememberSupabaseSession(await response.json()) ? 'signed-in' : 'confirm-email';
}

export function isGoogleAuthAvailable() {
  return !isLocalDemo() && Boolean(supabaseAuthConfig());
}

export async function signInWithGoogle(origin: string, next: string) {
  const config = supabaseAuthConfig();
  if (!config || !isGoogleAuthAvailable()) throw new Error('Google sign-in is unavailable.');
  const authorize = new URL('/auth/v1/authorize', config.url);
  authorize.search = new URLSearchParams({
    provider: 'google',
    redirect_to: authCallbackUrl(resolveAppOrigin(origin), next),
    ...await createPkce(next),
  }).toString();
  return authorize.toString();
}

export async function completeSupabaseSignIn(code: string) {
  if (isLocalDemo()) return false;
  const jar = await cookies();
  const verifier = jar.get(authCookies.verifier)?.value;
  if (!verifier) return false;
  jar.set(authCookies.verifier, '', authCookieOptions(0));

  const response = await supabaseAuthRequest('/token?grant_type=pkce', {
    body: { auth_code: code, code_verifier: verifier },
  });
  return response.ok && await rememberSupabaseSession(await response.json());
}

export async function completeSupabaseEmailVerification(tokenHash: string) {
  if (isLocalDemo()) return false;
  const response = await supabaseAuthRequest('/verify', { body: { token_hash: tokenHash, type: 'email' } });
  return response.ok && await rememberSupabaseSession(await response.json());
}

export async function signInDemo(role: keyof typeof demoUsers | 'studio_owner') {
  if (!isLocalDemo()) throw new Error('Demo accounts are only available in local demo mode.');
  const key = role === 'studio_owner' ? 'studio' : role;
  if (!Object.hasOwn(demoUsers, key)) throw new Error('This demo account is unavailable.');
  const id = demoUsers[key];
  if (!await getProfile(id)) throw new Error('This demo account is unavailable.');
  await rememberDemoUser(id);
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(authCookies.access)?.value;
  if (!isLocalDemo() && token && supabaseAuthConfig()) {
    await supabaseAuthRequest('/logout?scope=local', { body: {}, token }).catch(() => undefined);
  }
  for (const name of [demoCookie, ...Object.values(authCookies)]) jar.set(name, '', authCookieOptions(0));
}
