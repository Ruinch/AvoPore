import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { postgresConnectionOptions } from "../src/lib/postgres-config.mjs";

async function prepareHostedCatalog() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Production deployment.");

  const client = new Client({
    ...postgresConnectionOptions(databaseUrl, process.env.SUPABASE_DB_CA_CERT),
    connectionTimeoutMillis: 15_000,
  });
  try {
    await client.connect();
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('avopore:national-catalog'))");

    const { rows: [schema] } = await client.query(
      "select to_regclass('public.studios') as studios, to_regclass('public.studios_state_city_idx') as national",
    );
    if (!schema.studios) throw new Error("Apply the base AvoPore schema first.");
    if (!schema.national) {
      await client.query(await readFile(new URL(
        "../supabase/migrations/20261115000200_national_catalog.sql", import.meta.url,
      ), "utf8"));
    }

    if (process.env.AVOPORE_SIMULATE_PAYMENTS === "1"
      && !process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
      await client.query(await readFile(new URL("../supabase/national-demo-seed.sql", import.meta.url), "utf8"));
    }

    await client.query("commit");
    console.log("National catalog ready.");
  } finally {
    await client.end();
  }
}

if (process.env.VERCEL_ENV === "production") {
  try {
    await prepareHostedCatalog();
  } catch (error) {
    const reason = error.code || (error.message === "Apply the base AvoPore schema first."
      || error.message === "DATABASE_URL is required for Production deployment." ? error.message : error.name);
    console.error("National catalog setup failed:", reason);
    process.exitCode = 1;
  }
}
