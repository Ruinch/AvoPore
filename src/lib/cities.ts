export const cities = [
  { slug: "new-york", name: "New York City", label: "New York", region: "NY", timezone: "America/New_York" },
  { slug: "chicago", name: "Chicago", label: "Chicago", region: "IL", timezone: "America/Chicago" },
  { slug: "los-angeles", name: "Los Angeles", label: "Los Angeles", region: "CA", timezone: "America/Los_Angeles" },
] as const;

export type City = (typeof cities)[number];
export type DiscoverFilters = { category?: string; date?: string; tokens?: string };

export function cityBySlug(value: unknown) {
  return cities.find(({ slug }) => slug === value);
}

export function cityByName(name: string) {
  return cities.find((city) => city.name === name);
}

export function discoverHref(citySlug: string, filters: DiscoverFilters = {}) {
  const params = new URLSearchParams({ city: citySlug });
  if (filters.category) params.set("category", filters.category);
  if (filters.date) params.set("date", filters.date);
  if (filters.tokens) params.set("tokens", filters.tokens);
  return "/discover?" + params.toString();
}
