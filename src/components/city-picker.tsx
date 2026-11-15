import { MapPin } from "lucide-react";
import { chooseState } from "@/app/city-actions";
import { states, type City, type DiscoverFilters } from "@/lib/cities";
import styles from "./city-picker.module.css";

export function CityPicker({ city, surface, filters }: {
  city: City;
  surface: "home" | "discover";
  filters?: DiscoverFilters;
}) {
  return <form action={chooseState} className={styles.form} aria-label="Workshop location">
    <input type="hidden" name="surface" value={surface} />
    {filters?.category && <input type="hidden" name="category" value={filters.category} />}
    {filters?.date && <input type="hidden" name="date" value={filters.date} />}
    {filters?.tokens && <input type="hidden" name="tokens" value={filters.tokens} />}
    <label className={"field " + styles.field}>
      <span><MapPin size={15} aria-hidden /> State</span>
      <select key={city.region} name="state" defaultValue={city.region}>
        {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
      </select>
    </label>
    <button type="submit" className={"button button-secondary " + styles.submit}>Show workshops</button>
  </form>;
}
