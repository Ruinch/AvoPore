import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { categories, formatDay, formatTime, getSessions, seatsLabel, sessionHref, type CatalogSession } from "@/lib/catalog";
import { CityPicker } from "@/components/city-picker";
import { discoverHref, type DiscoverFilters } from "@/lib/cities";
import { getBrowseCity } from "@/lib/city-preference";
import { workshopPhoto } from "@/lib/workshop-photos";
import styles from "./catalog.module.css";

export const metadata = { title: "Workshop calendar" };
export const dynamic = "force-dynamic";

const priceOptions = [6, 8, 10, 12];
const filterDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
});

function readDate(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const day = new Date(value + "T12:00:00Z");
  if (Number.isFinite(day.valueOf()) && day.toISOString().slice(0, 10) === value) return value;
}

function groupWorkshops(sessions: CatalogSession[]) {
  const groups = new Map<string, CatalogSession[]>();
  for (const session of sessions) {
    const current = groups.get(session.slug);
    if (current) current.push(session);
    else groups.set(session.slug, [session]);
  }
  return [...groups.values()];
}

function WorkshopDates({ sessions, eager }: { sessions: CatalogSession[]; eager: boolean }) {
  const first = sessions[0];
  const firstAvailable = sessions.find((session) => session.spots > 0) ?? first;
  return <article className={styles.listing} aria-labelledby={"workshop-" + first.slug}>
    <div className={styles.thumbnail}>
      <Image src={workshopPhoto(first.image_key).src} alt="" fill loading={eager ? "eager" : "lazy"}
        sizes="(max-width: 640px) 84px, (max-width: 960px) 128px, 180px" />
    </div>
    <div className={styles.listingCopy}>
      <p className={styles.craft}>{categories[first.category] ?? first.category}</p>
      <h2 id={"workshop-" + first.slug}><Link href={sessionHref(firstAvailable)}>{first.title}</Link></h2>
      <p className={styles.studio}><span>{first.studio_name}</span><span>{first.neighborhood}</span></p>
      <p className={styles.price}><strong>{first.token_cost} tokens</strong><span>{first.duration_minutes} min</span></p>
    </div>
    <ul className={styles.dates} aria-label={"Dates for " + first.title}>
      {sessions.slice(0, 3).map((session) => {
        const when = formatDay(session.starts_at, session.timezone) + " · " + formatTime(session.starts_at, session.timezone);
        const availability = seatsLabel(session.spots);
        return <li key={session.id}>
          <Link href={sessionHref(session)} className={styles.dateLink}
            aria-label={first.title + ", " + when + ", " + availability}>
            <time dateTime={new Date(session.starts_at).toISOString()}>{when}</time>
            <span className={session.spots > 0 ? styles.availability : styles.soldOut}>{availability}</span>
            <ArrowRight size={15} strokeWidth={1.7} aria-hidden />
          </Link>
        </li>;
      })}
      {sessions.length > 3 && <li>
        <Link href={sessionHref(firstAvailable)} className={styles.extraDates}>View all dates <ArrowRight size={14} aria-hidden /></Link>
      </li>}
    </ul>
  </article>;
}

export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const city = await getBrowseCity(params.city);
  const category = typeof params.category === "string" && Object.hasOwn(categories, params.category)
    ? params.category as keyof typeof categories
    : undefined;
  const date = readDate(params.date);
  const tokens = priceOptions.map(String).find((value) => value === params.tokens);
  const filters: DiscoverFilters = { category, date, tokens };
  const sessions = await getSessions({ city: city.name, category, date, maxTokens: tokens ? Number(tokens) : undefined });
  const workshops = groupWorkshops(sessions);
  const applied = [
    category && { key: "category", label: categories[category] },
    date && { key: "date", label: filterDate.format(new Date(date + "T12:00:00Z")) },
    tokens && { key: "tokens", label: "Up to " + tokens + " tokens" },
  ].filter((value): value is { key: string; label: string } => Boolean(value));

  return <section className={"shell " + styles.page} aria-labelledby="catalogue-title">
    <header className={styles.intro}>
      <h1 className="display" id="catalogue-title">Workshop calendar</h1>
      <p>Pick a date at an independent studio in {city.name}.</p>
      <CityPicker city={city} surface="discover" filters={filters} />
    </header>

    <form key={discoverHref(city.slug, filters)} action="/discover" className={styles.filters} aria-label="Workshop filters">
      <input type="hidden" name="city" value={city.slug} />
      <label className="field">Category<select name="category" defaultValue={category ?? ""}>
        <option value="">All categories</option>
        {Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label className="field">Date<input type="date" name="date" defaultValue={date} /></label>
      <label className="field">Maximum tokens<select name="tokens" defaultValue={tokens ?? ""}>
        <option value="">Any price</option>
        {priceOptions.map((number) => <option key={number} value={number}>{number} tokens</option>)}
      </select></label>
      <button className={"button button-primary " + styles.filterButton}>Apply filters</button>
    </form>

    {applied.length > 0 && <ul className={styles.applied} aria-label="Applied filters">
      {applied.map(({ key, label }) => <li key={key}>
        <Link href={discoverHref(city.slug, { ...filters, [key]: undefined })} aria-label={"Remove " + label + " filter"}>
          {label}<X size={14} aria-hidden />
        </Link>
      </li>)}
      <li><Link href={discoverHref(city.slug)} className={styles.clear}>Clear filters</Link></li>
    </ul>}

    <p className={styles.count}>
      {workshops.length} {workshops.length === 1 ? "workshop" : "workshops"}
      <span aria-hidden="true"> · </span><span className="sr-only"> across </span>
      {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
    </p>
    {workshops.length ? <div className={styles.list}>
      {workshops.map((dates, index) => <WorkshopDates key={dates[0].slug} sessions={dates} eager={index === 0} />)}
    </div> : <div className={styles.empty}>
      <h2>{applied.length ? "No workshops match these filters." : `No upcoming workshops in ${city.name}.`}</h2>
      <p>{applied.length ? "Try another date, category, or token limit." : "Check back for new dates or explore another city."}</p>
    </div>}
  </section>;
}
