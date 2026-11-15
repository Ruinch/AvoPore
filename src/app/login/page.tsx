import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { demoAction, googleAction, loginAction, signupAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { isDemoSignInAvailable, isGoogleAuthAvailable } from "@/lib/auth";
import { loginPath, safeReturnPath } from "@/lib/auth-navigation";
import { isLocalDemo } from "@/lib/db";
import { errorMessage } from "@/lib/messages";
import styles from "./login.module.css";

export const metadata = { title: "Sign in" };

const demoRoles = [
  { role: "member", title: "Member demo", description: "Book a workshop and try the token balance." },
  { role: "studio", title: "Studio demo", description: "Publish sessions and check in participants." },
  { role: "admin", title: "Admin demo", description: "Review bookings, payouts, and owner reports." },
] as const;

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const options = await searchParams;
  const signup = options.mode === "signup";
  const error = errorMessage(options.error);
  const destination = safeReturnPath(options.next);
  const next = destination ?? "/account";
  const localDemo = isLocalDemo();
  const demo = isDemoSignInAvailable();
  const availableRoles = localDemo ? demoRoles : demoRoles.filter(({ role }) => role === "member");
  const demoPanel = demo && <aside className={styles.demo} aria-labelledby="demo-title">
    <h2 id="demo-title">{localDemo ? "Local demo" : "Try the demo"}</h2>
    <p>{localDemo ? "Select a role to explore AvoPore." : "Open a demo account to try booking workshops with test tokens."}</p>
    <ul>
      {availableRoles.map(({ role, title, description }) => <li key={role}>
        {localDemo && <p>{description}</p>}
        <form action={demoAction}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="next" value={destination ?? "/discover"} />
          <SubmitButton secondary={localDemo}>{title} <ArrowUpRight size={14} aria-hidden /></SubmitButton>
        </form>
      </li>)}
    </ul>
  </aside>;

  return <section className={"shell " + styles.login} data-demo={demo} aria-labelledby="sign-in-title">
    {!localDemo && demoPanel}
    <div className={styles.account}>
      <header className={styles.header}>
        <h1 className={styles.title} id="sign-in-title">{signup ? "Create an account" : "Sign in"}</h1>
        <p>{signup ? "Book workshops and manage your tokens in one place." : "Access your workshop bookings and token balance."}</p>
      </header>

      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {options.status === "check-email" && <p className="notice" role="status">Check your inbox and follow the confirmation link to finish signing up.</p>}

      <form action={signup ? signupAction : loginAction} className={styles.form}>
        <input name="next" type="hidden" value={next} />
        {signup && <label className="field">Full name<input name="name" minLength={2} maxLength={80} autoComplete="name" required /></label>}
        <label className="field">Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
        <div>
          <label className="field">Password<input type="password" name="password" minLength={8} maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"} aria-describedby={signup ? "signup-password-hint" : undefined} required /></label>
          {signup && <p className={styles.hint} id="signup-password-hint">Use at least 8 characters.</p>}
        </div>
        <SubmitButton>{signup ? "Create account" : "Sign in"} <ArrowUpRight size={16} aria-hidden /></SubmitButton>
      </form>

      {isGoogleAuthAvailable() && <form action={googleAction} className={styles.google}>
        <input name="next" type="hidden" value={destination ?? "/discover"} />
        <SubmitButton secondary>Continue with Google</SubmitButton>
      </form>}
      <p className={styles.switchMode}>
        {signup ? "Have an account?" : "New to AvoPore?"}{" "}
        <Link href={loginPath(next, signup ? undefined : { mode: "signup" })} className="text-link">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>

    {localDemo && demoPanel}
  </section>;
}
