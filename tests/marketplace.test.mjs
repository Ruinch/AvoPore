import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const seed = new URL("../supabase/seed.sql", import.meta.url);
const nationalSeed = new URL("../supabase/national-demo-seed.sql", import.meta.url);

async function one(db, sql, parameters = []) {
  const { rows } = await db.query(sql, parameters);
  assert.equal(rows.length, 1);
  return rows[0];
}

async function rpc(db, name, ...args) {
  const placeholders = args.map((_, index) => "$" + (index + 1)).join(", ");
  const { value } = await one(db, "select public." + name + "(" + placeholders + ") as value", args);
  return value;
}

async function createProfile(db, name = "Test Member") {
  const id = randomUUID();
  const email = id + "@example.test";
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify({ full_name: name }),
  ]);
  return { id, email };
}

async function createTemplate(db, tokenCost = 8, payoutCents = 1900) {
  const { id: studioId } = await one(db, "select id from public.studios order by slug limit 1");
  const { id } = await one(db, `
    insert into public.class_templates (
      studio_id, slug, title, category, description, included, experience, take_home,
      duration_minutes, image_key, token_cost, payout_cents
    ) values (
      $1, $2, 'Test workshop', 'ceramics', 'Make a bowl', 'Clay and tools', 'Beginner',
      'A bowl', 120, 'ceramics', $3, $4
    ) returning id
  `, [studioId, "test-" + randomUUID(), tokenCost, payoutCents]);
  return { id, studioId };
}

async function createSession(db, templateId, startOffset, quota = 6) {
  const { id } = await one(db, `
    insert into public.sessions (template_id, starts_at, capacity, quota)
    values ($1, now() + $2::interval, 8, $3) returning id
  `, [templateId, startOffset, quota]);
  return id;
}

async function issue(db, memberId, {
  payment = randomUUID(), startOffset = "-2 days", endOffset = "20 days",
} = {}) {
  const { start_at, end_at } = await one(db, `
    select (now() + $1::interval)::text as start_at, (now() + $2::interval)::text as end_at
  `, [startOffset, endOffset]);
  return rpc(db, "issue_cycle", memberId, "starter", payment, 3900, start_at, end_at);
}

test("AvoPore marketplace transactions", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
  `);
  for (const name of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, migrations), "utf8"));
  }
  await db.exec(await readFile(seed, "utf8"));
  await db.exec(await readFile(nationalSeed, "utf8"));

  await t.test("the demo includes all 50 states with nine categories and four dates per workshop", async () => {
    const { rows: locations } = await db.query(`
      select d.state_code, d.city, d.timezone, count(distinct c.category)::int as categories,
        count(distinct c.id)::int as workshops, count(s.id)::int as sessions,
        min(s.starts_at) >= now() + interval '23 hours' as starts_soon,
        min(s.starts_at) <= now() + interval '9 days' as starts_within_a_week,
        max(s.starts_at) >= now() + interval '27 days' as dates_four_weeks_out
      from public.studios d
      join public.class_templates c on c.studio_id = d.id
      join public.sessions s on s.template_id = c.id and s.status = 'published' and s.starts_at > now()
      where d.slug like 'demo-workshop-lab-%'
      group by d.state_code, d.city, d.timezone order by d.state_code
    `);
    assert.equal(locations.length, 50);
    assert.equal(new Set(locations.map(({ state_code }) => state_code)).size, 50);
    for (const location of locations) {
      assert.equal(location.categories, 9, location.city);
      assert.equal(location.workshops, 9, location.city);
      assert.equal(location.sessions, 36, location.city);
      assert.equal(location.starts_soon, true, location.city);
      assert.equal(location.starts_within_a_week, true, location.city);
      assert.equal(location.dates_four_weeks_out, true, location.city);
    }
    assert.equal(locations.find(({ city }) => city === "Anchorage").timezone, "America/Anchorage");
    assert.equal(locations.find(({ city }) => city === "Honolulu").timezone, "Pacific/Honolulu");

    const { rows: cookingSlots } = await db.query(`
      select distinct to_char(s.starts_at at time zone d.timezone, 'HH24:MI') as local_time,
        extract(isodow from s.starts_at at time zone d.timezone)::int as weekday
      from public.studios d
      join public.class_templates c on c.studio_id = d.id and c.category = 'cooking'
      join public.sessions s on s.template_id = c.id
    `);
    assert.deepEqual(cookingSlots, [{ local_time: "18:30", weekday: 4 }]);
    const { rows: plans } = await db.query("select id, price_cents, tokens from public.plans order by price_cents");
    assert.deepEqual(plans, [
      { id: "starter", price_cents: 3900, tokens: 12 },
      { id: "studio", price_cents: 6900, tokens: 24 },
      { id: "collective", price_cents: 9900, tokens: 40 },
    ]);
  });

  await t.test("reapplying the rollout leaves existing fixture dates and bookings intact", async () => {
    const member = await createProfile(db);
    const fixtureId = "00000000-0000-4000-a000-000000000003";
    await issue(db, member.id);
    const booking = await rpc(db, "book_session", member.id, fixtureId, randomUUID());
    const before = await one(db, `
      select starts_at::text, capacity, quota, booked_count
      from public.sessions where id = $1
    `, [fixtureId]);
    const { rows: existingSessions } = await db.query("select id from public.sessions order by id");

    await db.exec(await readFile(nationalSeed, "utf8"));

    const { rows: reappliedSessions } = await db.query("select id from public.sessions order by id");
    assert.deepEqual(reappliedSessions, existingSessions);
    const unchanged = await one(db, `
      select starts_at::text, capacity, quota, booked_count
      from public.sessions where id = $1
    `, [fixtureId]);
    assert.deepEqual(unchanged, before);
    assert.deepEqual(await one(db, "select session_id, status from public.bookings where id = $1", [booking.booking_id]), {
      session_id: fixtureId, status: "confirmed",
    });
  });

  await t.test("a national demo workshop can be booked and refunded", async () => {
    const member = await createProfile(db);
    await issue(db, member.id);
    const { id, token_cost } = await one(db, `
      select s.id, c.token_cost from public.sessions s
      join public.class_templates c on c.id = s.template_id and c.category = 'photography'
      join public.studios d on d.id = c.studio_id and d.state_code = 'HI'
      order by s.starts_at limit 1
    `);
    const booking = await rpc(db, "book_session", member.id, id, randomUUID());
    assert.equal(booking.created, true);
    assert.equal(await rpc(db, "token_balance", member.id), 12 - token_cost);
    await rpc(db, "cancel_booking", member.id, booking.booking_id);
    assert.equal(await rpc(db, "token_balance", member.id), 12);
  });

  await t.test("auth sign-up creates an unprivileged member and a zero balance", async () => {
    const { id, email } = await createProfile(db, "Avery Stone");
    const profile = await one(db, "select email, full_name, role, studio_id from public.profiles where id = $1", [id]);
    assert.deepEqual(profile, { email, full_name: "Avery Stone", role: "member", studio_id: null });
    assert.equal(await rpc(db, "token_balance", id), 0);
  });

  await t.test("local sign-up creates the profile and password credential together", async () => {
    const id = randomUUID();
    const result = await one(db, `
      with demo_user as (
        insert into auth.users (id, email, raw_user_meta_data)
        values ($1, $2, '{"full_name":"Demo Signup","role":"admin"}'::jsonb) returning id
      )
      insert into public.demo_credentials (user_id, password_hash)
      select id, 'fixture-hash' from demo_user returning user_id
    `, [id, id + "@example.test"]);
    assert.equal(result.user_id, id);
    const { full_name, role, password_hash } = await one(db, `
      select p.full_name, p.role, c.password_hash
      from public.profiles p join public.demo_credentials c on c.user_id = p.id
      where p.id = $1
    `, [id]);
    assert.equal(full_name, "Demo Signup");
    assert.equal(role, "member");
    assert.equal(password_hash, "fixture-hash");
  });

  await t.test("payment retries issue exactly one grant with a balanced append-only journal", async () => {
    const member = await createProfile(db);
    const payment = randomUUID();
    const first = await issue(db, member.id, { payment });
    const second = await issue(db, member.id, { payment });
    assert.equal(first.created, true);
    assert.deepEqual(second, { ...first, created: false });
    assert.equal(await rpc(db, "token_balance", member.id), 12);
    const { count } = await one(db, "select count(*)::int as count from public.billing_cycles where member_id = $1", [member.id]);
    assert.equal(count, 1);
    const entries = await db.query(`
      select a.kind, e.amount
      from public.ledger_entries e join public.token_accounts a on a.id = e.account_id
      where e.grant_id = $1 order by e.amount
    `, [first.grant_id]);
    assert.deepEqual(entries.rows, [{ kind: "issuance", amount: -12 }, { kind: "member", amount: 12 }]);
    await assert.rejects(db.query("update public.ledger_entries set amount = 9 where grant_id = $1", [first.grant_id]), /IMMUTABLE_LEDGER/);
    await assert.rejects(db.query("delete from public.ledger_entries where grant_id = $1", [first.grant_id]), /IMMUTABLE_LEDGER/);
    await assert.rejects(db.query(`
      insert into public.ledger_entries (account_id, grant_id, amount, reason, operation_key, idempotency_key)
      select account_id, grant_id, 1, reason, 'test-unbalanced', 'test-unbalanced:member'
      from public.ledger_entries e join public.token_accounts a on a.id = e.account_id
      where e.grant_id = $1 and a.member_id = $2
    `, [first.grant_id, member.id]), /UNBALANCED_LEDGER_OPERATION/);
    assert.equal(await rpc(db, "token_balance", member.id), 12);

    await db.exec("set role authenticated");
    try {
      await assert.rejects(rpc(db, "issue_cycle", member.id, "starter", payment, 3900,
        "2026-11-01T08:00:00Z", "2026-12-01T08:00:00Z"), { code: "42501" });
      await assert.rejects(db.query("select amount from public.ledger_entries"), { code: "42501" });
    } finally {
      await db.exec("reset role");
    }
  });

  await t.test("another Stripe invoice for the same subscription period cannot mint more tokens", async () => {
    const member = await createProfile(db);
    const bounds = await one(db, `
      select (now() - interval '1 day')::text as start_at, (now() + interval '1 month')::text as end_at
    `);
    const suffix = randomUUID();
    const period = [3900, bounds.start_at, bounds.end_at, "cus_" + suffix, "sub_" + suffix];
    const first = await rpc(db, "issue_cycle", member.id, "starter", "invoice-first-" + suffix, ...period);
    const duplicate = await rpc(db, "issue_cycle", member.id, "starter", "invoice-duplicate-" + suffix, ...period);
    assert.equal(first.created, true);
    assert.deepEqual(duplicate, { ...first, created: false });
    assert.equal(await rpc(db, "token_balance", member.id), 12);
  });

  await t.test("server role can complete journal transactions while direct ledger writes stay denied", async () => {
    const member = await createProfile(db);
    await db.exec("set role service_role");
    try {
      assert.equal((await issue(db, member.id)).created, true);
      assert.equal(await rpc(db, "token_balance", member.id), 12);
      const report = await one(db, "select count(*)::int as studios from public.payout_report");
      assert.equal(report.studios, 61);
      await assert.rejects(db.query("delete from public.ledger_entries"), { code: "42501" });
    } finally {
      await db.exec("reset role");
    }
  });

  await t.test("bookings spend across grants in expiry order and return both grants before the deadline", async () => {
    const member = await createProfile(db);
    const template = await createTemplate(db);
    const later = await issue(db, member.id, { endOffset: "24 days" });
    const sooner = await issue(db, member.id, { endOffset: "12 days" });
    const firstSession = await createSession(db, template.id, "2 days");
    const requestId = randomUUID();
    const first = await rpc(db, "book_session", member.id, firstSession, requestId);
    const replay = await rpc(db, "book_session", member.id, firstSession, requestId);
    assert.equal(first.created, true);
    assert.deepEqual(replay, { booking_id: first.booking_id, created: false });
    assert.equal(await rpc(db, "token_balance", member.id), 16);

    const secondSession = await createSession(db, template.id, "24 hours 1 minute");
    await assert.rejects(rpc(db, "book_session", member.id, secondSession, requestId), /IDEMPOTENCY_KEY_CONFLICT/);

    await db.transaction(async (tx) => {
      const second = await rpc(tx, "book_session", member.id, secondSession, randomUUID());
      assert.equal(await rpc(tx, "token_balance", member.id), 8);
      const { rows: allocations } = await tx.query(`
        select e.grant_id, e.amount
        from public.ledger_entries e
        join public.token_accounts a on a.id = e.account_id
        join public.token_grants g on g.id = e.grant_id
        where e.booking_id = $1 and e.reason = 'spend' and a.member_id = $2
        order by g.expires_at
      `, [second.booking_id, member.id]);
      assert.deepEqual(allocations, [
        { grant_id: sooner.grant_id, amount: -4 },
        { grant_id: later.grant_id, amount: -4 },
      ]);
      const result = await rpc(tx, "cancel_booking", member.id, second.booking_id);
      assert.equal(result.status, "cancelled_free");
      assert.equal(result.refunded_tokens, 8);
      assert.equal(await rpc(tx, "token_balance", member.id), 16);
      const { booked_count } = await one(tx, "select booked_count from public.sessions where id = $1", [secondSession]);
      assert.equal(booked_count, 0);
      await rpc(tx, "cancel_booking", member.id, second.booking_id);
      assert.equal(await rpc(tx, "token_balance", member.id), 16);
    });
  });

  await t.test("insufficient funds roll back inventory, booking and any partial ledger spend", async () => {
    const member = await createProfile(db);
    const template = await createTemplate(db, 13);
    const session = await createSession(db, template.id, "3 days");
    await assert.rejects(rpc(db, "book_session", member.id, session, randomUUID()), /SUBSCRIPTION_REQUIRED/);
    await issue(db, member.id);
    await assert.rejects(rpc(db, "book_session", member.id, session, randomUUID()), /INSUFFICIENT_TOKENS/);
    assert.equal(await rpc(db, "token_balance", member.id), 12);
    const inventory = await one(db, "select booked_count from public.sessions where id = $1", [session]);
    assert.equal(inventory.booked_count, 0);
    const bookings = await one(db, "select count(*)::int as count from public.bookings where session_id = $1", [session]);
    assert.equal(bookings.count, 0);
  });

  await t.test("parallel attempts for a final seat preserve the loser's full balance", async () => {
    const members = await Promise.all([createProfile(db), createProfile(db)]);
    for (const member of members) await issue(db, member.id);
    const template = await createTemplate(db);
    const session = await createSession(db, template.id, "3 days", 1);
    // PGlite queues these on one connection. The same functions lock rows in hosted PostgreSQL.
    const results = await Promise.allSettled(
      members.map((member) => rpc(db, "book_session", member.id, session, randomUUID())),
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.match(rejected.reason.message, /SOLD_OUT/);
    const winner = results.findIndex((result) => result.status === "fulfilled");
    assert.equal(await rpc(db, "token_balance", members[winner].id), 4);
    assert.equal(await rpc(db, "token_balance", members[1 - winner].id), 12);
    const inventory = await one(db, "select booked_count, quota from public.sessions where id = $1", [session]);
    assert.deepEqual(inventory, { booked_count: 1, quota: 1 });
  });

  await t.test("a late cancellation releases its seat and only an audited admin can refund", async () => {
    const member = await createProfile(db);
    const admin = await createProfile(db, "Test Admin");
    await db.query("update public.profiles set role = 'admin' where id = $1", [admin.id]);
    await issue(db, member.id);
    const template = await createTemplate(db);
    const session = await createSession(db, template.id, "23 hours 59 minutes");
    const { booking_id: bookingId } = await rpc(db, "book_session", member.id, session, randomUUID());
    const cancellation = await rpc(db, "cancel_booking", member.id, bookingId);
    assert.equal(cancellation.status, "cancelled_late");
    assert.equal(cancellation.refunded_tokens, 0);
    assert.equal(await rpc(db, "token_balance", member.id), 4);
    const { booked_count } = await one(db, "select booked_count from public.sessions where id = $1", [session]);
    assert.equal(booked_count, 0);
    await assert.rejects(rpc(db, "admin_refund", member.id, bookingId, "Duplicate charge"), /FORBIDDEN/);
    const refund = await rpc(db, "admin_refund", admin.id, bookingId, "Approved service exception");
    assert.equal(refund.refunded_tokens, 8);
    assert.deepEqual(await rpc(db, "admin_refund", admin.id, bookingId, "Retry by same admin"), refund);
    assert.equal(await rpc(db, "token_balance", member.id), 12);
    const audit = await one(db, "select actor_id, reason from public.audit_log where booking_id = $1", [bookingId]);
    assert.deepEqual(audit, { actor_id: admin.id, reason: "Approved service exception" });
  });

  await t.test("studio check-in and report use the payout captured when the member booked", async () => {
    const member = await createProfile(db);
    const studioOwner = await createProfile(db, "Studio Owner");
    const otherOwner = await createProfile(db, "Other Studio Owner");
    const template = await createTemplate(db);
    const { id: otherStudioId } = await one(db, "select id from public.studios where id <> $1 order by slug limit 1", [template.studioId]);
    await db.query("update public.profiles set role = 'studio_owner', studio_id = $1 where id = $2", [
      template.studioId, studioOwner.id,
    ]);
    await db.query("update public.profiles set role = 'studio_owner', studio_id = $1 where id = $2", [
      otherStudioId, otherOwner.id,
    ]);

    const when = await one(db, "select (now() + interval '30 minutes')::text as value");
    const { session_id: session } = await rpc(db, "studio_create_session", studioOwner.id, template.id, when.value, 8, 4);
    const quota = await rpc(db, "studio_update_quota", studioOwner.id, session, 2);
    assert.equal(quota.quota, 2);
    await issue(db, member.id);
    const { booking_id: bookingId } = await rpc(db, "book_session", member.id, session, randomUUID());

    await assert.rejects(rpc(db, "studio_update_quota", studioOwner.id, session, 0), /INVALID_QUOTA/);
    await assert.rejects(rpc(db, "check_in", otherOwner.id, bookingId), /FORBIDDEN/);
    const before = await one(db, `
      select attended_count, payout_cents, used_tokens, revenue_cents
      from public.payout_report where studio_id = $1
    `, [template.studioId]);
    await db.query("update public.class_templates set payout_cents = 2800 where id = $1", [template.id]);
    const checkIn = await rpc(db, "check_in", studioOwner.id, bookingId);
    assert.equal(checkIn.status, "attended");
    const after = await one(db, `
      select attended_count, payout_cents, used_tokens, revenue_cents, revenue_per_token_cents
      from public.payout_report where studio_id = $1
    `, [template.studioId]);
    assert.equal(Number(after.attended_count) - Number(before.attended_count), 1);
    assert.equal(Number(after.payout_cents) - Number(before.payout_cents), 1900);
    assert.equal(Number(after.used_tokens) - Number(before.used_tokens), 8);
    assert.equal(Number(after.revenue_cents) - Number(before.revenue_cents), 2600);
    assert.equal(Number(after.revenue_per_token_cents), Number(after.revenue_cents) / Number(after.used_tokens));
  });

  await t.test("expired tokens disappear immediately and the sweep posts one ledger transfer", async () => {
    const member = await createProfile(db);
    const historical = await issue(db, member.id, { startOffset: "-32 days", endOffset: "-2 days" });
    assert.equal(await rpc(db, "token_balance", member.id), 0);
    await rpc(db, "expire_tokens");
    await rpc(db, "expire_tokens");
    const { rows } = await db.query(`
      select a.kind, e.amount
      from public.ledger_entries e join public.token_accounts a on a.id = e.account_id
      where e.grant_id = $1 and e.reason = 'expire' order by e.amount
    `, [historical.grant_id]);
    assert.deepEqual(rows, [{ kind: "member", amount: -12 }, { kind: "expired", amount: 12 }]);
  });
});
