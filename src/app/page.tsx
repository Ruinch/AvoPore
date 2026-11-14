import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SessionCard } from "@/components/session-card";
import { categories, getSessions } from "@/lib/catalog";
import { workshopPhotos } from "@/lib/workshop-photos";

export const dynamic = "force-dynamic";

export default async function Home() {
  const upcoming = await getSessions({ limit: 36 });
  const picks = Object.keys(categories).flatMap((category) => upcoming.find((session) => session.category === category) ?? []).slice(0, 3);
  return <>
    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="location"><MapPin size={15} aria-hidden /> NEW YORK CITY</div>
        <h1 id="hero-title">Make time to<br /> <em>make things.</em></h1>
        <p>Get your hands dirty, try a new craft, and meet the people who make New York. One membership opens the door to independent studios across the city.</p>
        <div className="hero-actions"><Link className="button button-primary" href="/discover">Explore workshops <ArrowUpRight size={17} aria-hidden /></Link><Link className="text-link" href="#how-it-works">How it works <ArrowDownRight size={16} aria-hidden /></Link></div>
      </div>
      <div className="hero-visual">
        <Image src={workshopPhotos.hero.src} alt={workshopPhotos.hero.alt} fill priority sizes="(max-width: 760px) 95vw, 53vw" />
        <Link href="/discover?category=ceramics" className="photo-caption"><span>Get your hands in clay</span><ArrowUpRight size={16} aria-hidden /></Link>
      </div>
    </section>

    <section className="workshop-section" aria-labelledby="workshops-title"><div className="shell">
      <div className="section-head"><div><p className="eyebrow">Book a workshop</p><h2 className="display" id="workshops-title">Find your next thing.</h2></div>
      <Link href="/discover" className="text-link">View all workshops <ArrowRight size={17} aria-hidden /></Link></div>
      <div className="category-list"><Link href="/discover" className="category-link category-link-active">All workshops</Link>{Object.entries(categories).map(([id, name]) => <Link className="category-link" href={`/discover?category=${id}`} key={id}>{name}</Link>)}</div>
      {picks.length ? <div className="card-grid">{picks.map((session) => <SessionCard key={session.id} session={session} />)}</div> : <p className="notice">New workshops are added as studios publish dates. Check back soon.</p>}
    </div></section>

    <section className="how-section shell" id="how-it-works" aria-labelledby="how-title">
      <div><p className="eyebrow">AvoPore membership</p><h2 className="display" id="how-title">From curious to hands-on.</h2><Link className="button button-secondary" href="/membership">See plans <ArrowUpRight size={16} aria-hidden /></Link></div>
      <ol><li><h3>Pick a monthly plan</h3><p>Get a fresh batch of tokens every billing cycle.</p></li><li><h3>Spend tokens on workshops</h3><p>See the token price and available dates before booking.</p></li><li><h3>Show up and make something</h3><p><CalendarDays size={16} aria-hidden /> Your booking includes the materials listed by the studio.</p></li></ol>
    </section>
  </>;
}
