"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cityBySlug, discoverHref } from "@/lib/cities";
import { cityCookie } from "@/lib/city-preference";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function chooseCity(form: FormData) {
  const city = cityBySlug(form.get("city"));
  if (!city) return;

  (await cookies()).set(cityCookie, city.slug, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });

  if (form.get("surface") === "home") redirect("/?city=" + city.slug);
  redirect(discoverHref(city.slug, {
    category: field(form, "category"),
    date: field(form, "date"),
    tokens: field(form, "tokens"),
  }));
}
