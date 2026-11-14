import Link from "next/link";
import { Search } from "lucide-react";
import { SessionCard } from "@/components/session-card";
import { categories, getSessions } from "@/lib/catalog";

export const metadata = { title: "Workshops" };
export const dynamic = "force-dynamic";

export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const category = typeof params.category === "string" && Object.hasOwn(categories, params.category) ? params.category : undefined;
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;
  const tokens = ["6", "8", "10", "12"].find((option) => option === params.tokens);
  const sessions = await getSessions({ category, date, maxTokens: tokens ? Number(tokens) : undefined });
  return <section className="shell page-section">
    <div className="page-heading"><p className="eyebrow">New York City</p><h1 className="display">Explore workshops.</h1><p>Find a seat at an independent studio and try a craft at your own pace.</p></div>
    <form action="/discover" className="panel filter-bar">
      <label className="field">Category<select name="category" defaultValue={category ?? ""}><option value="">All categories</option>{Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="field">Date<input type="date" name="date" defaultValue={date} /></label>
      <label className="field">Maximum tokens<select name="tokens" defaultValue={tokens ?? ""}><option value="">Any price</option>{[6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} tokens</option>)}</select></label>
      <button className="button button-primary"><Search size={16} aria-hidden /> Apply filters</button>
    </form>
    <div className="results-line"><p>{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</p>{(category || date || tokens) && <Link className="text-link" href="/discover">Clear filters</Link>}</div>
    {sessions.length ? <div className="card-grid">{sessions.map((session, index) => <SessionCard key={session.id} session={session} eager={index === 0} />)}</div> : <p className="notice">No sessions match these filters. Try a different date or category.</p>}
  </section>;
}
