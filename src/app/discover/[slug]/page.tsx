import { randomUUID } from "node:crypto";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bookAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { isSessionId, loginPath } from "@/lib/auth-navigation";
import { categories, formatDay, formatTime, getSession, getSessions, sessionHref } from "@/lib/catalog";
import { cityByName, discoverHref } from "@/lib/cities";
import { workshopPhoto } from "@/lib/workshop-photos";
import { rpc } from "@/lib/db";
import { errorMessage } from "@/lib/messages";
import styles from "./detail.module.css";

export const dynamic = "force-dynamic";

export default async function Workshop({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, options] = await Promise.all([params, searchParams]);
  const [sessions, user, requested] = await Promise.all([
    getSessions({ slug }),
    getCurrentUser(),
    isSessionId(options.session) ? getSession(options.session) : undefined,
  ]);
  const selected = options.session === undefined ? sessions[0] : requested?.slug === slug ? requested : undefined;
  const session = selected ?? sessions[0];
  if (!session) notFound();

  const now = Date.now();
  const isAvailable = selected?.status === "published" && new Date(selected.starts_at).getTime() > now;
  const otherDates = sessions.filter((slot) => slot.id !== selected?.id);
  const balance = isAvailable && user?.role === "member" ? await rpc<number>("token_balance", { p_member_id: user.id }) : null;
  const error = errorMessage(options.error);
  const map = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(session.address);
  const deadline = new Date(new Date(session.starts_at).getTime() - 24 * 60 * 60 * 1000);
  const detailPath = sessionHref(session);
  const city = cityByName(session.city);
  const catalogPath = city ? discoverHref(city.slug) : "/discover";
  const categoryPath = city ? discoverHref(city.slug, { category: session.category }) : "/discover?category=" + session.category;
  const photo = workshopPhoto(session.image_key);
  const nextStep = otherDates.length ? "Choose another date below." : "Browse all workshops for more options.";

  return (
    <article className={"shell " + styles.page} aria-labelledby="workshop-title">
      <nav className={styles.breadcrumb} aria-label="Workshop navigation">
        <Link href={catalogPath}><ArrowLeft size={16} aria-hidden /> {city ? city.name + " workshops" : "All workshops"}</Link>
        <span aria-hidden="true">/</span>
        <Link href={categoryPath}>{categories[session.category]}</Link>
      </nav>

      <div className={styles.layout}>
        <header className={styles.heading}>
          <h1 id="workshop-title">{session.title}</h1>
          <p><strong>{session.studio_name}</strong><span aria-hidden="true"> · </span>{session.neighborhood}<span aria-hidden="true"> · </span>{session.city}</p>
        </header>

        <aside className={styles.reservation} aria-labelledby="booking-heading">
          <section className={styles.booking}>
            <div className={styles.bookingHeader}>
              <h2 id="booking-heading">Reserve a seat</h2>
              {selected && <p className={styles.price}><strong>{selected.token_cost}</strong> {selected.token_cost === 1 ? "token" : "tokens"}</p>}
            </div>

            {selected && (
              <div className={styles.sessionFacts}>
                <time dateTime={new Date(selected.starts_at).toISOString()}>
                  {formatDay(selected.starts_at, selected.timezone, true)} · {formatTime(selected.starts_at, selected.timezone, true)}
                </time>
                <p>
                  {selected.duration_minutes} min
                  <span aria-hidden="true"> · </span>
                  {isAvailable ? selected.spots > 0 ? selected.spots + (selected.spots === 1 ? " seat left" : " seats left") : "Sold out" : "Unavailable"}
                </p>
              </div>
            )}

            {error && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.action}>
              {!isAvailable ? (
                <p role="status" className={styles.message}>That session is unavailable. {nextStep}</p>
              ) : session.spots <= 0 ? (
                <p role="status" className={styles.message}>This session is sold out. {nextStep}</p>
              ) : !user ? (
                <Link href={loginPath(detailPath)} className="button button-primary">Sign in to book <ArrowRight size={17} aria-hidden /></Link>
              ) : user.role !== "member" ? (
                <p className={styles.message}>Reservations are available with a member account.</p>
              ) : balance !== null && balance < session.token_cost ? (
                <>
                  <p className={styles.balance}>Your balance is {balance} {balance === 1 ? "token" : "tokens"}.</p>
                  <Link className="button button-primary" href="/membership">View membership <ArrowRight size={17} aria-hidden /></Link>
                </>
              ) : (
                <form action={bookAction}>
                  <input type="hidden" name="session" value={session.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="request" value={randomUUID()} />
                  <SubmitButton pendingText="Reserving…">Book for {session.token_cost} {session.token_cost === 1 ? "token" : "tokens"} <ArrowRight size={17} aria-hidden /></SubmitButton>
                </form>
              )}
            </div>

            {isAvailable && (
              <p className={styles.policy}>
                {deadline.getTime() >= now ? (
                  <>Cancel by <time dateTime={deadline.toISOString()}>{formatDay(deadline, session.timezone)} at {formatTime(deadline, session.timezone, true)}</time> for a full token refund. Later cancellations release your seat without refunding tokens.</>
                ) : (
                  "The token refund deadline has passed. Cancelling releases your seat and the tokens stay spent."
                )}
              </p>
            )}
          </section>

          {otherDates.length > 0 && (
            <section className={styles.dates} aria-labelledby="other-dates">
              <h2 id="other-dates">Other dates</h2>
              <ul>
                {otherDates.map((slot) => (
                  <li key={slot.id}>
                    <Link href={sessionHref(slot)}>
                      <time dateTime={new Date(slot.starts_at).toISOString()}>
                        <strong>{formatDay(slot.starts_at, slot.timezone)}</strong><span>{formatTime(slot.starts_at, slot.timezone, true)}</span>
                      </time>
                      {slot.spots <= 0 && <span className={styles.soldOut}>Sold out</span>}
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div className={styles.story}>
          <div className={styles.photo}>
            <Image src={photo.src} alt={photo.alt} fill priority sizes="(max-width: 760px) 94vw, (max-width: 1280px) 60vw, 800px" />
          </div>

          <section className={styles.notes} aria-labelledby="workshop-notes">
            <h2 id="workshop-notes">About the workshop</h2>
            <p className={styles.description}>{session.description}</p>
            <dl className={styles.facts}>
              <div><dt>What’s included</dt><dd>{session.included}</dd></div>
              <div><dt>Experience level</dt><dd>{session.experience}</dd></div>
              <div><dt>Take home</dt><dd>{session.take_home}</dd></div>
              <div>
                <dt>Studio</dt>
                <dd>
                  {session.studio_name}
                  <a className={styles.map} href={map} target="_blank" rel="noreferrer">
                    <span>{session.address}</span><ArrowUpRight size={15} aria-hidden />
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </article>
  );
}
