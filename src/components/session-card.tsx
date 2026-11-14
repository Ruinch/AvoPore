import { ArrowUpRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { categories, formatDay, formatTime, type CatalogSession } from "@/lib/catalog";
import { workshopPhoto } from "@/lib/workshop-photos";

export function SessionCard({ session, eager = false }: { session: CatalogSession; eager?: boolean }) {
  return <article className="session-card">
    <Link href={`/discover/${session.slug}?session=${session.id}`} className="card-image" aria-label={`View ${session.title}`}>
      <Image src={workshopPhoto(session.image_key).src} alt="" fill loading={eager ? "eager" : "lazy"} sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 360px" />
      <span className="card-category">{categories[session.category] ?? session.category}</span>
      <span className="card-arrow" aria-hidden><ArrowUpRight size={19} /></span>
    </Link>
    <div className="card-body">
      <div className="card-meta"><span>{formatDay(session.starts_at, session.timezone)} · {formatTime(session.starts_at, session.timezone)}</span><span className="token-pill">{session.token_cost} tokens</span></div>
      <h3><Link href={`/discover/${session.slug}?session=${session.id}`}>{session.title}</Link></h3>
      <p><MapPin size={14} aria-hidden /> {session.studio_name} · {session.neighborhood}</p>
    </div>
  </article>;
}
