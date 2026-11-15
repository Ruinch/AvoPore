import { Aperture } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isLocalDemo } from "@/lib/db";
import { SiteNavigation } from "@/components/site-navigation";

export function Wordmark() {
  return <Link href="/" aria-label="AvoPore home" className="wordmark"><Aperture size={24} strokeWidth={1.8} aria-hidden /> <span>AvoPore</span></Link>;
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  return <header className="site-header">
    <div className="shell nav-inner">
      <Wordmark />
      <SiteNavigation showOwner={user?.role === "admin"} showMobileSignIn={!user} />
      <div className="nav-actions">
        {user?.role === "admin" && <Link href="/admin">Admin</Link>}
        {user?.studioId && <Link href="/studio">Studio</Link>}
        {user ? <Link className="button button-secondary nav-button" href="/account">My account</Link>
          : <><Link href="/login" className="nav-login">Sign in</Link><Link className="button button-primary nav-button" href={isLocalDemo() ? "/login" : "/login?mode=signup"}>{isLocalDemo() ? "Try the demo" : "Join AvoPore"}</Link></>}
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="shell footer-inner">
    <div><Wordmark /><p>Creative workshops at independent studios.</p></div>
    <nav aria-label="Footer navigation"><Link href="/discover">Workshops</Link><Link href="/membership">Membership</Link><Link href="/login">Sign in</Link><Link href="/photo-credits">Photo credits</Link></nav>
  </div></footer>;
}
