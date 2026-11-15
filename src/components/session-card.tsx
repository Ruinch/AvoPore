import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { categories, formatDay, formatTime, seatsLabel, sessionHref, type CatalogSession } from "@/lib/catalog";
import { workshopPhoto } from "@/lib/workshop-photos";
import styles from "./session-card.module.css";

export function SessionCard({ session, eager = false }: { session: CatalogSession; eager?: boolean }) {
  return <article className={styles.card}>
    <Link href={sessionHref(session)} className={styles.link}>
      <div className={styles.image}>
        <Image src={workshopPhoto(session.image_key).src} alt="" fill loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 480px) 100vw, (max-width: 780px) 50vw, 380px" />
      </div>
      <div className={styles.copy}>
        <p className={styles.category}>{categories[session.category] ?? session.category}</p>
        <h3>{session.title}<ArrowRight size={17} strokeWidth={1.7} aria-hidden /></h3>
        <p className={styles.context}>{session.studio_name} · {session.neighborhood}</p>
        <p className={styles.context}><time dateTime={new Date(session.starts_at).toISOString()}>
          {formatDay(session.starts_at, session.timezone)} · {formatTime(session.starts_at, session.timezone)}
        </time></p>
        <p className={styles.stats}><strong>{session.token_cost} tokens</strong>
          <span className={session.spots ? styles.available : styles.soldOut}>{seatsLabel(session.spots)}</span>
        </p>
      </div>
    </Link>
  </article>;
}
