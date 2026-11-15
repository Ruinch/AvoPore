import { cookies } from "next/headers";
import { cities, cityBySlug } from "@/lib/cities";

export const cityCookie = "avopore-city";

export async function getBrowseCity(requested: unknown) {
  const explicit = cityBySlug(requested);
  if (explicit) return explicit;
  const saved = (await cookies()).get(cityCookie)?.value;
  return cityBySlug(saved) ?? cities[0];
}
