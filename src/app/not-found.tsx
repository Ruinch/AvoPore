import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return <section className="shell page-section"><div className="page-heading"><h1 className="display">Page unavailable.</h1><p>Browse upcoming workshops to find something on the calendar.</p></div><Link className="button button-primary" href="/discover">Explore workshops <ArrowUpRight size={16} aria-hidden /></Link></section>;
}
