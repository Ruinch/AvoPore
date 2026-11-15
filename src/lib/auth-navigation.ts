export const membershipPlanCodes = ["starter", "studio", "collective"] as const;

const sessionId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const workshopPath = /^\/discover\/[a-z0-9-]{1,100}$/;

export function isMembershipPlan(value: unknown): value is typeof membershipPlanCodes[number] {
  return membershipPlanCodes.some((plan) => plan === value);
}

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && sessionId.test(value);
}

export function safeReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 155) return;
  if (value === "/account" || value === "/discover" || value === "/membership") return value;

  const [pathname, query, extra] = value.split("?");
  if (extra !== undefined) return;
  if (pathname === "/membership" && query?.startsWith("plan=") && isMembershipPlan(query.slice(5))) return value;
  if (workshopPath.test(pathname) && pathname.trimEnd() === pathname &&
      (query === undefined || (query.startsWith("session=") && isSessionId(query.slice(8))))) return value;
}

export function loginPath(next: string, options?: { mode?: "signup"; error?: string; status?: string }) {
  const params = new URLSearchParams({ next });
  if (options?.mode) params.set("mode", options.mode);
  if (options?.error) params.set("error", options.error);
  if (options?.status) params.set("status", options.status);
  return `/login?${params}`;
}

export function authCallbackUrl(origin: string, next: string) {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeReturnPath(next) ?? "/discover");
  return callback.toString();
}

export function emailReturnPath(value: string | null, origin: string): string | undefined {
  if (!value) return;
  const direct = safeReturnPath(value);
  if (direct) return direct;

  try {
    const callback = new URL(value);
    if (callback.origin === origin && callback.pathname === "/auth/callback" && !callback.username && !callback.password) {
      return safeReturnPath(callback.searchParams.get("next"));
    }
  } catch {
    return;
  }
}
