import { randomUUID } from "node:crypto";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bookAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { isSessionId, loginPath } from "@/lib/auth-navigation";
import { categories, formatDay, formatTime, getSession, getSessions } from "@/lib/catalog";
import { workshopPhoto } from "@/lib/workshop-photos";
import { rpc } from "@/lib/db";
import { errorMessage } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function Workshop({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, options] = await Promise.all([params, searchParams]);
  const [sessions, user, requested] = await Promise.all([
    getSessions({ slug }), getCurrentUser(), isSessionId(options.session) ? getSession(options.session) : undefined,
  ]);
  const selected = options.session === undefined ? sessions[0] : requested?.slug === slug ? requested : undefined;
  const session = selected ?? sessions[0];
  if (!session) notFound();
  const isAvailable = Boolean(selected && selected.status === "published" && new Date(selected.starts_at).valueOf() > Date.now());
  const otherDates = sessions.filter((slot) => slot.id !== selected?.id);
  const balance = isAvailable && user?.role === "member" ? await rpc<number>("token_balance", { p_member_id: user.id }) : null;
  const error = errorMessage(options.error);
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.address)}`;
  const deadline = new Date(new Date(session.starts_at).valueOf() - 24 * 60 * 60 * 1000);
  const detailPath = `/discover/${slug}?session=${session.id}`;
  const photo = workshopPhoto(session.image_key);
  return <section className="shell page-section">
    <Link className="text-link back-link" href="/discover"><ArrowLeft size={16} aria-hidden /> All workshops</Link>
    <div className="detail-layout">
      <div className="page-heading detail-heading mt-0! mb-0! min-[761px]:col-start-1 min-[761px]:row-start-2"><p className="eyebrow">{categories[session.category]} · {session.neighborhood}</p><h1 className="display">{session.title}</h1><p>{session.description}</p></div>
      <aside className="panel booking-panel min-[761px]:col-start-2 min-[761px]:row-start-1 min-[761px]:row-span-3" aria-label="Reserve a seat">
        <p className="eyebrow">Reserve a seat</p>
        {selected && <>
          <div className="booking-price"><Ticket size={23} aria-hidden /><strong>{selected.token_cost}</strong> tokens</div>
          <div className="booking-info"><span><CalendarDays size={17} aria-hidden /> {formatDay(selected.starts_at, selected.timezone, true)}, {formatTime(selected.starts_at, selected.timezone)} NYC time</span><span><Clock3 size={17} aria-hidden /> {selected.duration_minutes} minutes · {isAvailable ? selected.spots > 0 ? `${selected.spots} ${selected.spots === 1 ? "seat" : "seats"} available` : "Sold out" : "Unavailable"}</span></div>
        </>}
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        {!isAvailable ? <p role="status" className="notice">That session is unavailable. {otherDates.length ? "Choose another date below." : "Browse all workshops for more options."}</p> : session.spots <= 0 ? <p className="notice">This session is sold out. {otherDates.length ? "Choose another date below." : "Browse all workshops for more options."}</p> : !user ? <Link href={loginPath(detailPath)} className="button button-primary">Sign in to book <ArrowUpRight size={17} aria-hidden /></Link> : user.role !== "member" ? <p className="notice">Reservations are available with a member account.</p> : balance !== null && balance < session.token_cost ? <><p className="muted">Your balance is {balance} tokens.</p><Link className="button button-primary" href="/membership">View membership <ArrowUpRight size={17} aria-hidden /></Link></> : <form action={bookAction}>
          <input type="hidden" name="session" value={session.id} /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="request" value={randomUUID()} />
          <SubmitButton pendingText="Reserving…">Book for {session.token_cost} tokens <ArrowUpRight size={17} aria-hidden /></SubmitButton>
        </form>}
        {isAvailable && <p className="policy-note">Cancel by {formatDay(deadline, session.timezone)} at {formatTime(deadline, session.timezone)} NYC time for a full token refund. Later cancellations release your seat without a token refund.</p>}
        {otherDates.length > 0 && <div className="slot-list mt-3 border-t! border-[var(--line)]"><h2>Other dates</h2>{otherDates.map((s) => <Link href={`/discover/${slug}?session=${s.id}`} key={s.id}>{formatDay(s.starts_at, s.timezone)} · {formatTime(s.starts_at, s.timezone)}{s.spots <= 0 ? " · Sold out" : ""} <ArrowUpRight size={15} aria-hidden /></Link>)}</div>}
      </aside>
      <div className="detail-image min-[761px]:col-start-1 min-[761px]:row-start-1"><Image src={photo.src} alt={photo.alt} fill priority sizes="(max-width: 760px) 95vw, 62vw" /></div>
      <div className="facts-grid min-[761px]:col-start-1 min-[761px]:row-start-3">
        <div><h2>What’s included</h2><p>{session.included}</p></div><div><h2>Experience level</h2><p>{session.experience}</p></div>
        <div><h2>Take home</h2><p>{session.take_home}</p></div><div><h2>Studio</h2><p>{session.studio_name}</p><a className="text-link" href={map} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden /> {session.address} <ArrowUpRight size={15} aria-hidden /></a></div>
      </div>
    </div>
  </section>;
}
