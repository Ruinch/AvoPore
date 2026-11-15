"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNavigation({ showOwner, showMobileSignIn }: { showOwner: boolean; showMobileSignIn: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/discover", title: "Workshops" },
    { href: "/membership", title: "Membership" },
    ...(showOwner ? [{ href: "/owner", title: "Owner" }] : []),
  ];

  return <nav className="site-nav" aria-label="Main navigation">
    {items.map(({ href, title }) => <Link key={href} className="nav-item" href={href}
      aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}>{title}</Link>)}
    {showMobileSignIn && <Link className="nav-item mobile-sign-in" href="/login"
      aria-current={path === "/login" ? "page" : undefined}>Sign in</Link>}
  </nav>;
}
