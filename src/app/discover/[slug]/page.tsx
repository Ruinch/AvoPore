import { randomUUID } from "node:crypto";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bookAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { categories, formatDay, formatTime, getSessions } from "@/lib/catalog";
import { workshopPhoto } from "@/lib/workshop-photos";
import { rpc } from "@/lib/db";
import { errorMessage } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function Workshop({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, options] = await Promise.all([params, searchParams]);
  const [sessions, user] = await Promise.all([getSessions({ slug }), getCurrentUser()]);
  const session = (options.session ? sessions.find((s) => s.id === options.session) : null) ?? sessions[0];
  if (!session) notFound();
  const balance = user?.role === "member" ? await rpc<number>("token_balance", { p_member_id: user.id }) : null;
  const error = errorMessage(options.error);
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.address)}`;
  const deadline = new Date(new Date(session.starts_at).valueOf() - 24 * 60 * 60 * 1000);
  const photo = workshopPhoto(session.image_key);
  return <section className="shell page-section">
    <Link className="text-link back-link" href="/discover"><ArrowLeft size={16} aria-hidden /> All workshops</Link>
    <div className="detail-layout">
      <div className="detail-main">
        <div className="detail-image"><Image src={photo.src} alt={photo.alt} fill priority sizes="(max-width: 760px) 95vw, 62vw" /></div>
        <div className="page-heading detail-heading"><p className="eyebrow">{categories[session.category]} · {session.neighborhood}</p><h1 className="display">{session.title}</h1><p>{session.description}</p></div>
        <div className="facts-grid">
          <div><h2>What’s included</h2><p>{session.included}</p></div><div><h2>Experience level</h2><p>{session.experience}</p></div>
          <div><h2>Take home</h2><p>{session.take_home}</p></div><div><h2>Studio</h2><p>{session.studio_name}</p><a className="text-link" href={map} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden /> {session.address} <ArrowUpRight size={15} aria-hidden /></a></div>
        </div>
      </div>
      <aside className="panel booking-panel" aria-label="Reserve a seat">
        <p className="eyebrow">Reserve a seat</p><div className="booking-price"><Ticket size={23} aria-hidden /><strong>{session.token_cost}</strong> tokens</div>
        <div className="booking-info"><span><CalendarDays size={17} aria-hidden /> {formatDay(session.starts_at, session.timezone, true)}, {formatTime(session.starts_at, session.timezone)} NYC time</span><span><Clock3 size={17} aria-hidden /> {session.duration_minutes} minutes · {session.spots > 0 ? `${session.spots} ${session.spots === 1 ? "seat" : "seats"} available` : "Sold out"}</span></div>
        {sessions.length > 1 && <div className="slot-list"><h2>Other dates</h2>{sessions.filter((s) => s.id !== session.id).map((s) => <Link href={`/discover/${slug}?session=${s.id}`} key={s.id}>{formatDay(s.starts_at, s.timezone)} · {formatTime(s.starts_at, s.timezone)} <ArrowUpRight size={15} aria-hidden /></Link>)}</div>}
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        {session.spots <= 0 ? <p className="notice">Pick another date to reserve a seat.</p> : !user ? <Link href="/login?next=/discover" className="button button-primary">Sign in to book <ArrowUpRight size={17} aria-hidden /></Link> : user.role !== "member" ? <p className="notice">Reservations are available with a member account.</p> : balance !== null && balance < session.token_cost ? <><p className="muted">Your balance is {balance} tokens.</p><Link className="button button-primary" href="/membership">View membership <ArrowUpRight size={17} aria-hidden /></Link></> : <form action={bookAction}>
          <input type="hidden" name="session" value={session.id} /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="request" value={randomUUID()} />
          <SubmitButton pendingText="Reserving…">Book for {session.token_cost} tokens <ArrowUpRight size={17} aria-hidden /></SubmitButton>
        </form>}
        <p className="policy-note">Cancel by {formatDay(deadline, session.timezone)} at {formatTime(deadline, session.timezone)} NYC time for a full token refund. Later cancellations release your seat without a token refund.</p>
      </aside>
    </div>
  </section>;
}
