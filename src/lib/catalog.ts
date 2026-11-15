import { query } from "@/lib/db";

export const categories = {
  ceramics: "Ceramics",
  printmaking: "Printmaking",
  textiles: "Textiles",
  painting: "Painting",
  florals: "Floral design",
} as const;

export type Category = keyof typeof categories;
export type CatalogSession = {
  id: string; slug: string; title: string; category: Category; description: string; included: string;
  experience: string; take_home: string; duration_minutes: number; image_key: string; level: string;
  token_cost: number; studio_name: string; city: string; neighborhood: string; address: string; timezone: string;
  starts_at: Date | string; spots: number; status: string;
};

const selection = `SELECT s.id, t.slug, t.title, t.category, t.description, t.included, t.experience,
  t.take_home, t.duration_minutes, t.image_key, t.level, t.token_cost, st.name AS studio_name,
  st.city, st.neighborhood, st.address, st.timezone, s.starts_at, (s.quota - s.booked_count)::int AS spots, s.status
  FROM public.sessions s JOIN public.class_templates t ON t.id = s.template_id
  JOIN public.studios st ON st.id = t.studio_id`;

export function getSessions(filters: { category?: string; date?: string; maxTokens?: number; slug?: string; city?: string; limit?: number } = {}) {
  return query<CatalogSession>(`${selection}
    WHERE s.status = 'published' AND s.starts_at > now()
    AND ($1::text IS NULL OR t.category = $1)
    AND ($2::text IS NULL OR to_char(s.starts_at AT TIME ZONE st.timezone, 'YYYY-MM-DD') = $2)
    AND ($3::int IS NULL OR t.token_cost <= $3)
    AND ($4::text IS NULL OR t.slug = $4)
    AND ($5::text IS NULL OR st.city = $5)
    ORDER BY s.starts_at, s.id LIMIT $6`, [
      filters.category ?? null, filters.date ?? null, filters.maxTokens ?? null, filters.slug ?? null, filters.city ?? null, filters.limit ?? 60,
    ]);
}

export async function getSession(id: string) {
  const [session] = await query<CatalogSession>(`${selection} WHERE s.id = $1`, [id]);
  return session;
}

export function formatDay(value: string | Date, timezone = "America/New_York", long = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: long ? "long" : "short", month: "short", day: "numeric",
  }).format(new Date(value));
}

export function formatTime(value: string | Date, timezone = "America/New_York", includeZone = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "numeric", minute: "2-digit", timeZoneName: includeZone ? "short" : undefined,
  }).format(new Date(value));
}

export function dollars(cents: number, decimals = 0) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(cents / 100);
}

export function sessionHref(session: Pick<CatalogSession, "slug" | "id">) {
  return "/discover/" + encodeURIComponent(session.slug) + "?session=" + encodeURIComponent(session.id);
}

export function seatsLabel(spots: number) {
  if (spots <= 0) return "Sold out";
  return spots + (spots === 1 ? " seat left" : " seats left");
}
