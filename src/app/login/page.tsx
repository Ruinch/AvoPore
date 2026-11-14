import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { demoAction, googleAction, loginAction, signupAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { isGoogleAuthAvailable } from "@/lib/auth";
import { isLocalDemo } from "@/lib/db";
import { errorMessage } from "@/lib/messages";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const options = await searchParams;
  const signup = options.mode === "signup";
  const error = errorMessage(options.error);
  const next = options.next === "/membership" || options.next === "/discover" ? options.next : "/account";
  return <section className="shell page-section auth-layout">
    <div className="page-heading"><p className="eyebrow">AvoPore account</p><h1 className="display">{signup ? "Create your account." : "Welcome back."}</h1><p>{signup ? "A New York studio is waiting for you." : "Sign in to book workshops and manage your tokens."}</p></div>
    <div className="panel auth-panel">
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {options.status === "check-email" && <p className="notice" role="status">Check your inbox and follow the confirmation link to finish signing up.</p>}
      <form action={signup ? signupAction : loginAction} className="form-stack">
        <input name="next" type="hidden" value={next} />
        {signup && <label className="field">Full name<input name="name" minLength={2} maxLength={80} autoComplete="name" required /></label>}
        <label className="field">Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
        <label className="field">Password<input type="password" name="password" minLength={8} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} required /></label>
        <SubmitButton>{signup ? "Create account" : "Sign in"} <ArrowUpRight size={16} aria-hidden /></SubmitButton>
      </form>
      {isGoogleAuthAvailable() && <form action={googleAction} className="auth-google"><SubmitButton secondary>Continue with Google</SubmitButton></form>}
      <p className="auth-switch">{signup ? "Have an account?" : "New to AvoPore?"} <Link href={`/login?${signup ? "" : "mode=signup&"}next=${encodeURIComponent(next)}`} className="text-link">{signup ? "Sign in" : "Create an account"}</Link></p>
      {isLocalDemo() && <div className="demo-signin"><h2>Local demo</h2><p>Choose a role to try the booking and studio workflows.</p><div>{(["member", "studio", "admin"] as const).map((role) => <form key={role} action={demoAction}><input type="hidden" name="role" value={role} /><SubmitButton secondary>{role[0].toUpperCase() + role.slice(1)} demo</SubmitButton></form>)}</div></div>}
    </div>
  </section>;
}
