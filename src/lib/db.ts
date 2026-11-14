import { mkdir, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

const globalDb = globalThis as typeof globalThis & {
  avoporePostgres?: Pool;
  avoporeDemo?: Promise<PGlite>;
};

export function isLocalDemo() {
  return !process.env.DATABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.VERCEL &&
    (process.env.NODE_ENV !== "production" || process.env.AVOPORE_LOCAL_DEMO === "1");
}

async function openDemo() {
  const dataDir = resolve(process.env.AVOPORE_DATA_DIR || ".avopore-data");
  await mkdir(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  try {
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE,
        raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE IF NOT EXISTS public.local_migrations (name text PRIMARY KEY);
      DO $$ BEGIN
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    const dir = join(process.cwd(), "supabase", "migrations");
    const migrations = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const filename of migrations) {
      const { rows } = await db.query("SELECT 1 FROM public.local_migrations WHERE name = $1", [filename]);
      if (rows.length) continue;
      const migration = await readFile(join(dir, filename), "utf8");
      await db.transaction(async (tx) => {
        await tx.exec(migration);
        await tx.query("INSERT INTO public.local_migrations VALUES ($1)", [filename]);
      });
    }
    const { rows } = await db.query("SELECT 1 FROM public.local_migrations WHERE name = 'local-demo-seed'");
    if (!rows.length) {
      const seed = await readFile(join(process.cwd(), "supabase", "seed.sql"), "utf8");
      await db.transaction(async (tx) => {
        await tx.exec(seed);
        await tx.exec(`
          INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
            ('00000000-0000-4000-8000-000000000001', 'member@avopore.example', '{"full_name":"Jamie Rivera"}'),
            ('00000000-0000-4000-8000-000000000002', 'studio@avopore.example', '{"full_name":"Morgan Lee"}'),
            ('00000000-0000-4000-8000-000000000003', 'admin@avopore.example', '{"full_name":"Alex Chen"}');
          UPDATE public.profiles SET role = 'studio_owner', studio_id = (SELECT id FROM public.studios WHERE slug = 'clay-house')
            WHERE id = '00000000-0000-4000-8000-000000000002';
          UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000000003';
          INSERT INTO public.local_migrations VALUES ('local-demo-seed');
        `);
      });
    }
  } catch (error) {
    await db.close();
    throw error;
  }
  return db;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isLocalDemo()) {
    globalDb.avoporeDemo ??= openDemo().catch((error) => {
      delete globalDb.avoporeDemo;
      throw error;
    });
    const db = await globalDb.avoporeDemo;
    return (await db.query<T>(sql, params)).rows;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required on a hosted deployment.");
  if (!globalDb.avoporePostgres) {
    const connectionString = new URL(process.env.DATABASE_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(connectionString.hostname);
    const ca = process.env.SUPABASE_DB_CA_CERT?.replaceAll("\\n", "\n");
    if (ca) connectionString.searchParams.delete("sslmode");
    const pool = new Pool({
      connectionString: connectionString.toString(), max: 4, connectionTimeoutMillis: 5000,
      ssl: ca || !local ? { rejectUnauthorized: true, ca } : undefined,
    });
    pool.on("error", (error) => console.error("Idle database connection closed", { error: error.name }));
    globalDb.avoporePostgres = pool;
  }
  return (await globalDb.avoporePostgres.query(sql, params)).rows as T[];
}

export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const keys = Object.keys(args);
  if (![name, ...keys].every((key) => /^[a-z][a-z0-9_]*$/.test(key))) throw new Error("Invalid SQL function or argument name.");
  const placeholders = keys.map((key, i) => `${key} => $${i + 1}`).join(", ");
  const [row] = await query<{ data: T }>(`SELECT public.${name}(${placeholders}) AS data`, Object.values(args));
  return row.data;
}
