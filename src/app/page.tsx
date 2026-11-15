import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CityPicker } from "@/components/city-picker";
import { discoverHref } from "@/lib/cities";
import { getBrowseCity } from "@/lib/city-preference";
import { SessionCard } from "@/components/session-card";
import { categories, getSessions, type CatalogSession } from "@/lib/catalog";
import { workshopPhotos } from "@/lib/workshop-photos";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ city?: string | string[] }> }) {
  const city = await getBrowseCity((await searchParams).city);
  const upcoming = await getSessions({ city: city.name, limit: 36 });
  const picks = new Map<CatalogSession["category"], CatalogSession>();
  for (const session of upcoming) {
    if (!picks.has(session.category)) picks.set(session.category, session);
    if (picks.size === 3) break;
  }

  return (
    <>
      <section className={`shell ${styles.hero}`} aria-labelledby="hero-title">
        <div className={styles.intro}>
          <h1 id="hero-title">Creative workshops in {city.label}</h1>
          <p>Book a seat at an independent studio. Try pottery, printmaking, weaving, and more with a monthly membership.</p>
          <CityPicker city={city} surface="home" />
          <div className={styles.actions}>
            <Link className={`button button-primary ${styles.heroAction}`} href={discoverHref(city.slug)}>
              Explore workshops <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className={styles.inlineLink} href="#how-it-works">
              How membership works <ArrowDown size={15} aria-hidden />
            </Link>
          </div>
        </div>
        <figure className={styles.figure}>
          <div className={styles.photo}>
            <Image
              src={workshopPhotos.hero.src}
              alt={workshopPhotos.hero.alt}
              fill
              priority
              sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1300px) 57vw, 690px"
            />
          </div>
          <figcaption className={styles.caption}>
            <span>At the pottery wheel</span>
            <Link className={styles.inlineLink} href={discoverHref(city.slug, { category: "ceramics" })}>
              Explore ceramics <ArrowUpRight size={14} aria-hidden />
            </Link>
          </figcaption>
        </figure>
      </section>

      <section className={`shell ${styles.workshops}`} aria-labelledby="workshops-title">
        <header className={styles.sectionHeading}>
          <h2 id="workshops-title">Upcoming workshops</h2>
          <Link className={styles.inlineLink} href={discoverHref(city.slug)}>
            See the full calendar <ArrowRight size={16} aria-hidden />
          </Link>
        </header>
        <nav className={styles.categories} aria-label="Workshop categories">
          <ul>
            {Object.entries(categories).map(([id, name]) => (
              <li key={id}><Link href={discoverHref(city.slug, { category: id })}>{name}</Link></li>
            ))}
          </ul>
        </nav>
        {picks.size ? (
          <div className={styles.workshopGrid}>
            {[...picks.values()].map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        ) : <p className={styles.empty}>The next workshop dates will appear here when studios publish them.</p>}
      </section>

      <section className={`shell ${styles.membership}`} id="how-it-works" aria-labelledby="how-title">
        <div>
          <h2 id="how-title">How membership works</h2>
          <Link className={styles.inlineLink} href="/membership">
            See membership plans <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <ol className={styles.steps}>
          <li><h3>Choose a monthly plan</h3><p>Your plan sets the number of tokens you get each billing cycle.</p></li>
          <li><h3>Book with tokens</h3><p>Pick a workshop date. The token cost is shown before you reserve your seat.</p></li>
          <li><h3>Head to the studio</h3><p>Check the workshop listing for the address, materials, and what to bring.</p></li>
        </ol>
      </section>
    </>
  );
}
