export type City = {
  slug: string;
  name: string;
  label: string;
  region: string;
  timezone: string;
};

export type State = {
  code: string;
  name: string;
  cities: readonly City[];
};

type CityRow = readonly [slug: string, name: string, timezone: string, label?: string];
type StateRow = readonly [code: string, name: string, cities: readonly CityRow[]];

const stateRows: readonly StateRow[] = [
  ["AL", "Alabama", [["birmingham", "Birmingham", "America/Chicago"]]],
  ["AK", "Alaska", [["anchorage", "Anchorage", "America/Anchorage"]]],
  ["AZ", "Arizona", [["phoenix", "Phoenix", "America/Phoenix"]]],
  ["AR", "Arkansas", [["little-rock", "Little Rock", "America/Chicago"]]],
  ["CA", "California", [["los-angeles", "Los Angeles", "America/Los_Angeles"]]],
  ["CO", "Colorado", [["denver", "Denver", "America/Denver"]]],
  ["CT", "Connecticut", [["new-haven", "New Haven", "America/New_York"]]],
  ["DE", "Delaware", [["wilmington", "Wilmington", "America/New_York"]]],
  ["FL", "Florida", [["miami", "Miami", "America/New_York"]]],
  ["GA", "Georgia", [["atlanta", "Atlanta", "America/New_York"]]],
  ["HI", "Hawaii", [["honolulu", "Honolulu", "Pacific/Honolulu"]]],
  ["ID", "Idaho", [["boise", "Boise", "America/Boise"]]],
  ["IL", "Illinois", [["chicago", "Chicago", "America/Chicago"]]],
  ["IN", "Indiana", [["indianapolis", "Indianapolis", "America/Indiana/Indianapolis"]]],
  ["IA", "Iowa", [["des-moines", "Des Moines", "America/Chicago"]]],
  ["KS", "Kansas", [["wichita", "Wichita", "America/Chicago"]]],
  ["KY", "Kentucky", [["louisville", "Louisville", "America/Kentucky/Louisville"]]],
  ["LA", "Louisiana", [["new-orleans", "New Orleans", "America/Chicago"]]],
  ["ME", "Maine", [["bangor", "Bangor", "America/New_York"]]],
  ["MD", "Maryland", [["baltimore", "Baltimore", "America/New_York"]]],
  ["MA", "Massachusetts", [["boston", "Boston", "America/New_York"]]],
  ["MI", "Michigan", [["detroit", "Detroit", "America/Detroit"]]],
  ["MN", "Minnesota", [["minneapolis", "Minneapolis", "America/Chicago"]]],
  ["MS", "Mississippi", [["jackson", "Jackson", "America/Chicago"]]],
  ["MO", "Missouri", [["st-louis", "St. Louis", "America/Chicago"]]],
  ["MT", "Montana", [["billings", "Billings", "America/Denver"]]],
  ["NE", "Nebraska", [["omaha", "Omaha", "America/Chicago"]]],
  ["NV", "Nevada", [["las-vegas", "Las Vegas", "America/Los_Angeles"]]],
  ["NH", "New Hampshire", [["manchester", "Manchester", "America/New_York"]]],
  ["NJ", "New Jersey", [["newark", "Newark", "America/New_York"]]],
  ["NM", "New Mexico", [["albuquerque", "Albuquerque", "America/Denver"]]],
  ["NY", "New York", [["new-york", "New York City", "America/New_York", "New York"]]],
  ["NC", "North Carolina", [["charlotte", "Charlotte", "America/New_York"]]],
  ["ND", "North Dakota", [["fargo", "Fargo", "America/Chicago"]]],
  ["OH", "Ohio", [["columbus", "Columbus", "America/New_York"]]],
  ["OK", "Oklahoma", [["oklahoma-city", "Oklahoma City", "America/Chicago"]]],
  ["OR", "Oregon", [["portland", "Portland", "America/Los_Angeles"]]],
  ["PA", "Pennsylvania", [["philadelphia", "Philadelphia", "America/New_York"]]],
  ["RI", "Rhode Island", [["providence", "Providence", "America/New_York"]]],
  ["SC", "South Carolina", [["charleston", "Charleston", "America/New_York"]]],
  ["SD", "South Dakota", [["sioux-falls", "Sioux Falls", "America/Chicago"]]],
  ["TN", "Tennessee", [["nashville", "Nashville", "America/Chicago"]]],
  ["TX", "Texas", [["austin", "Austin", "America/Chicago"]]],
  ["UT", "Utah", [["salt-lake-city", "Salt Lake City", "America/Denver"]]],
  ["VT", "Vermont", [["burlington", "Burlington", "America/New_York"]]],
  ["VA", "Virginia", [["richmond", "Richmond", "America/New_York"]]],
  ["WA", "Washington", [["seattle", "Seattle", "America/Los_Angeles"]]],
  ["WV", "West Virginia", [["morgantown", "Morgantown", "America/New_York"]]],
  ["WI", "Wisconsin", [["milwaukee", "Milwaukee", "America/Chicago"]]],
  ["WY", "Wyoming", [["cheyenne", "Cheyenne", "America/Denver"]]],
];

export const states: readonly State[] = stateRows.map(([code, name, rows]) => ({
  code,
  name,
  cities: rows.map(([slug, name, timezone, label = name]) => ({
    slug, name, label, region: code, timezone,
  })),
}));

const defaultCitySlug = "new-york";

export const cities: readonly City[] = states.flatMap((state) => state.cities).sort(
  (a, b) => Number(b.slug === defaultCitySlug) - Number(a.slug === defaultCitySlug),
);

export type DiscoverFilters = { category?: string; date?: string; tokens?: string };

export function stateByCode(value: unknown) {
  return states.find(({ code }) => code === value);
}

export function cityBySlug(value: unknown) {
  return cities.find(({ slug }) => slug === value);
}

export function cityByName(name: string, region?: string) {
  return cities.find((city) => city.name === name && (!region || city.region === region));
}

export function discoverHref(citySlug: string, filters: DiscoverFilters = {}) {
  const params = new URLSearchParams({ city: citySlug });
  if (filters.category) params.set("category", filters.category);
  if (filters.date) params.set("date", filters.date);
  if (filters.tokens) params.set("tokens", filters.tokens);
  return "/discover?" + params.toString();
}
