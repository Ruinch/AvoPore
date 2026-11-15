import { MapPin } from "lucide-react";
import { chooseCity } from "@/app/city-actions";
import { cities, type City, type DiscoverFilters } from "@/lib/cities";
import styles from "./city-picker.module.css";

export function CityPicker({ city, surface, filters }: {
  city: City;
  surface: "home" | "discover";
  filters?: DiscoverFilters;
}) {
  return <form action={chooseCity} className={styles.form} aria-label="Choose a city">
    <input type="hidden" name="surface" value={surface} />
    {filters?.category && <input type="hidden" name="category" value={filters.category} />}
    {filters?.date && <input type="hidden" name="date" value={filters.date} />}
    {filters?.tokens && <input type="hidden" name="tokens" value={filters.tokens} />}
    <span className={styles.label}><MapPin size={15} aria-hidden /> City</span>
    <div className={styles.cities}>
      {cities.map((option) => <button key={option.slug} type="submit" name="city" value={option.slug}
        aria-pressed={city.slug === option.slug}>
        {option.label}
      </button>)}
    </div>
  </form>;
}
