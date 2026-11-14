-- AvoPore's marketplace and transaction boundary for the hackathon MVP.
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  neighborhood text not null,
  city text not null default 'New York City',
  address text not null,
  timezone text not null default 'America/New_York',
  description text not null
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'member'
    check (role in ('member', 'studio_owner', 'studio_staff', 'admin')),
  studio_id uuid references public.studios(id),
  created_at timestamptz not null default now(),
  check ((role in ('studio_owner', 'studio_staff')) = (studio_id is not null))
);

-- This table is used only by the local demonstration adapter.
create table public.demo_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null
);

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger avopore_profile_on_signup
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles(id, email, full_name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id),
  slug text not null unique,
  title text not null,
  category text not null check (category in ('ceramics', 'printmaking', 'textiles', 'painting', 'florals')),
  description text not null,
  included text not null,
  experience text not null,
  take_home text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  image_key text not null,
  level text not null default 'Beginner',
  token_cost integer not null check (token_cost > 0),
  payout_cents integer not null check (payout_cents >= 0)
);

create index class_templates_studio_idx on public.class_templates (studio_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.class_templates(id),
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  quota integer not null,
  booked_count integer not null default 0,
  status text not null default 'published' check (status in ('published', 'cancelled')),
  created_at timestamptz not null default now(),
  check (quota between 0 and capacity),
  check (booked_count between 0 and quota)
);

create index sessions_catalog_idx on public.sessions (starts_at) where status = 'published';
create unique index sessions_template_idx on public.sessions (template_id, starts_at);

create table public.plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents > 0),
  tokens integer not null check (tokens > 0)
);

insert into public.plans (id, name, price_cents, tokens) values
  ('starter', 'Starter', 3900, 12),
  ('studio', 'Studio', 6900, 24),
  ('collective', 'Collective', 9900, 40);

create table public.subscriptions (
  member_id uuid primary key references public.profiles(id),
  plan_id text not null references public.plans(id),
  status text not null check (status in ('active', 'cancelled', 'ending', 'past_due')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  period_end timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  plan_id text not null references public.plans(id),
  version text not null,
  consent_text text not null,
  ip text,
  created_at timestamptz not null default now()
);

create table public.checkout_attempts (
  member_id uuid primary key references public.profiles(id),
  plan_id text not null references public.plans(id),
  session_ref uuid not null default gen_random_uuid() unique,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  plan_id text not null references public.plans(id),
  payment_ref text not null unique,
  stripe_subscription_id text,
  amount_cents integer not null check (amount_cents > 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  check (period_start < period_end)
);

create index billing_cycles_member_idx on public.billing_cycles (member_id, period_end);
create unique index billing_cycles_stripe_period_idx
on public.billing_cycles (stripe_subscription_id, period_start)
where stripe_subscription_id is not null;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  session_id uuid not null references public.sessions(id),
  idempotency_key text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'attended', 'cancelled_free', 'cancelled_late')),
  tokens_charged integer not null check (tokens_charged > 0),
  refunded_tokens integer not null default 0,
  payout_cents integer not null check (payout_cents >= 0),
  retail_cents integer not null default 0 check (retail_cents >= 0),
  created_at timestamptz not null default now(),
  attended_at timestamptz,
  cancelled_at timestamptz,
  check (refunded_tokens between 0 and tokens_charged),
  unique (member_id, idempotency_key)
);

create unique index bookings_one_active_per_session
on public.bookings (member_id, session_id)
where status in ('confirmed', 'attended');

create index bookings_session_idx on public.bookings (session_id, status);

create table public.booking_requests (
  member_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  booking_id uuid not null references public.bookings(id),
  primary key (member_id, idempotency_key)
);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id),
  actor_id uuid not null references public.profiles(id),
  event text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

create table public.token_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid unique references public.profiles(id),
  kind text not null check (kind in ('member', 'issuance', 'spent', 'expired')),
  check ((kind = 'member') = (member_id is not null))
);

create unique index token_accounts_system_kind_idx on public.token_accounts (kind)
where member_id is null;

insert into public.token_accounts(kind) values ('issuance'), ('spent'), ('expired');

create table public.token_grants (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  billing_cycle_id uuid unique references public.billing_cycles(id),
  source text not null check (source in ('subscription', 'refund')),
  tokens integer not null check (tokens > 0),
  unit_value_cents numeric(10, 4) not null check (unit_value_cents >= 0),
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  check (granted_at < expires_at),
  check ((source = 'subscription') = (billing_cycle_id is not null))
);

create index token_grants_member_fifo_idx on public.token_grants (member_id, expires_at, granted_at, id);
create index token_grants_expiry_idx on public.token_grants (expires_at);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.token_accounts(id),
  grant_id uuid not null references public.token_grants(id),
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('issue', 'spend', 'refund', 'expire')),
  booking_id uuid references public.bookings(id),
  operation_key text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check ((reason in ('spend', 'refund')) = (booking_id is not null)),
  unique (operation_key, account_id)
);

create index ledger_entries_grant_idx on public.ledger_entries (grant_id, account_id);
create index ledger_entries_booking_idx on public.ledger_entries (booking_id) where booking_id is not null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  booking_id uuid references public.bookings(id),
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function public.reject_ledger_mutation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'IMMUTABLE_LEDGER';
end;
$$;

create trigger ledger_append_only
before update or delete or truncate on public.ledger_entries
for each statement execute function public.reject_ledger_mutation();

create function public.check_ledger_pair()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.ledger_entries e
    join public.token_accounts a on a.id = e.account_id
    join public.token_grants g on g.id = e.grant_id
    where e.operation_key = new.operation_key
    group by e.operation_key
    having count(*) = 2 and sum(e.amount) = 0
      and count(distinct e.grant_id) = 1 and count(distinct e.reason) = 1
      and count(distinct e.booking_id) <= 1
      and count(*) filter (where a.member_id = g.member_id
        and (e.amount > 0) = (e.reason in ('issue', 'refund'))) = 1
      and count(*) filter (where a.member_id is null and a.kind = case e.reason
        when 'issue' then 'issuance'
        when 'expire' then 'expired'
        else 'spent'
      end) = 1
  ) then
    raise exception 'UNBALANCED_LEDGER_OPERATION';
  end if;
  if exists (
    select 1
    from public.token_grants g
    join public.token_accounts a on a.member_id = g.member_id
    join public.ledger_entries e on e.grant_id = g.id and e.account_id = a.id
    where g.id = new.grant_id
    group by g.id
    having sum(e.amount) not between 0 and g.tokens
  ) then
    raise exception 'INVALID_TOKEN_GRANT_BALANCE';
  end if;
  return null;
end;
$$;

create constraint trigger ledger_double_entry
after insert on public.ledger_entries deferrable initially deferred
for each row execute function public.check_ledger_pair();

create function public.post_token_pair(
  p_grant_id uuid, p_amount integer, p_system_kind text, p_reason text,
  p_booking_id uuid, p_operation_key text
)
returns void
language sql set search_path = ''
as $$
  insert into public.ledger_entries
    (account_id, grant_id, amount, reason, booking_id, operation_key, idempotency_key)
  select a.id, g.id, p_amount, p_reason, p_booking_id, p_operation_key, p_operation_key || ':member'
  from public.token_grants g
  join public.token_accounts a on a.member_id = g.member_id
  where g.id = p_grant_id
  union all
  select a.id, p_grant_id, -p_amount, p_reason, p_booking_id, p_operation_key, p_operation_key || ':system'
  from public.token_accounts a
  where a.kind = p_system_kind and a.member_id is null;
$$;

create function public.token_balance(p_member_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(e.amount), 0)::integer
  from public.token_accounts a
  join public.ledger_entries e on e.account_id = a.id
  join public.token_grants g on g.id = e.grant_id
  where a.member_id = p_member_id
    and g.granted_at <= now() and g.expires_at > now();
$$;

create function public.issue_cycle(
  p_member_id uuid,
  p_plan_id text,
  p_payment_ref text,
  p_amount_cents integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_cycle public.billing_cycles%rowtype;
  v_grant_id uuid;
begin
  perform 1 from public.profiles where id = p_member_id and role = 'member' for update;
  if not found then raise exception 'FORBIDDEN'; end if;

  if coalesce(length(btrim(p_payment_ref)), 0) = 0
    or p_amount_cents is null or p_amount_cents <= 0
    or p_period_start is null or p_period_end is null or p_period_start >= p_period_end
    or (p_stripe_customer_id is null) <> (p_stripe_subscription_id is null)
  then
    raise exception 'INVALID_BILLING_CYCLE';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  select * into v_cycle
  from public.billing_cycles
  where payment_ref = p_payment_ref
     or (stripe_subscription_id = p_stripe_subscription_id and period_start = p_period_start)
  order by (payment_ref = p_payment_ref) desc
  limit 1;

  if v_cycle.id is not null then
    if v_cycle.member_id <> p_member_id or v_cycle.plan_id <> p_plan_id then
      raise exception 'PAYMENT_REF_CONFLICT';
    end if;
    select id into v_grant_id from public.token_grants where billing_cycle_id = v_cycle.id;
    return jsonb_build_object('created', false, 'grant_id', v_grant_id);
  end if;

  if p_payment_ref like 'demo:%' and exists (
    select 1 from public.subscriptions
    where member_id = p_member_id and period_end > clock_timestamp()
      and status in ('active', 'ending', 'past_due')
  ) then
    raise exception 'SUBSCRIPTION_ALREADY_ACTIVE';
  end if;

  insert into public.billing_cycles
    (member_id, plan_id, payment_ref, stripe_subscription_id, amount_cents, period_start, period_end)
  values
    (p_member_id, p_plan_id, p_payment_ref, p_stripe_subscription_id,
      p_amount_cents, p_period_start, p_period_end)
  returning * into v_cycle;

  insert into public.token_accounts (member_id, kind)
  values (p_member_id, 'member')
  on conflict (member_id) do nothing;

  insert into public.token_grants
    (member_id, billing_cycle_id, source, tokens, unit_value_cents, granted_at, expires_at)
  values
    (p_member_id, v_cycle.id, 'subscription', v_plan.tokens,
      p_amount_cents::numeric / v_plan.tokens, p_period_start, p_period_end)
  returning id into v_grant_id;

  perform public.post_token_pair(v_grant_id, v_plan.tokens, 'issuance', 'issue', null,
    'issue:' || v_cycle.id::text);

  insert into public.subscriptions
    (member_id, plan_id, status, stripe_customer_id, stripe_subscription_id, period_end)
  values (p_member_id, v_plan.id, 'active', p_stripe_customer_id, p_stripe_subscription_id, p_period_end)
  on conflict (member_id) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      stripe_customer_id = coalesce(excluded.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, subscriptions.stripe_subscription_id),
      period_end = excluded.period_end,
      updated_at = clock_timestamp()
  where excluded.period_end >= subscriptions.period_end;

  return jsonb_build_object('created', true, 'grant_id', v_grant_id);
end;
$$;

create function public.book_session(p_member_id uuid, p_session_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_session public.sessions%rowtype;
  v_template public.class_templates%rowtype;
  v_grant record;
  v_remaining integer;
  v_spend integer;
  v_retail_cents numeric := 0;
  v_now timestamptz;
begin
  if coalesce(length(btrim(p_idempotency_key)), 0) not between 1 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  perform 1 from public.profiles where id = p_member_id and role = 'member' for update;
  if not found then raise exception 'FORBIDDEN'; end if;

  select * into v_booking
  from public.bookings where id = (
    select booking_id from public.booking_requests
    where member_id = p_member_id and idempotency_key = p_idempotency_key
  );
  if v_booking.id is not null then
    if v_booking.session_id is distinct from p_session_id then
      raise exception 'IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return jsonb_build_object('booking_id', v_booking.id, 'created', false);
  end if;

  select * into v_booking
  from public.bookings
  where member_id = p_member_id and session_id = p_session_id
    and status in ('confirmed', 'attended');
  if v_booking.id is not null then
    insert into public.booking_requests (member_id, idempotency_key, booking_id)
    values (p_member_id, p_idempotency_key, v_booking.id);
    return jsonb_build_object('booking_id', v_booking.id, 'created', false);
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  v_now := clock_timestamp();
  if v_session.status <> 'published' or v_session.starts_at <= v_now then
    raise exception 'SESSION_UNAVAILABLE';
  end if;
  if v_session.booked_count >= v_session.quota then raise exception 'SOLD_OUT'; end if;

  perform 1 from public.subscriptions
  where member_id = p_member_id and status in ('active', 'ending') and period_end > v_now;
  if not found then raise exception 'SUBSCRIPTION_REQUIRED'; end if;

  select * into strict v_template from public.class_templates where id = v_session.template_id;
  v_remaining := v_template.token_cost;

  insert into public.bookings (member_id, session_id, idempotency_key, tokens_charged, payout_cents)
  values (p_member_id, p_session_id, p_idempotency_key, v_template.token_cost, v_template.payout_cents)
  returning * into v_booking;

  for v_grant in
    select g.id, g.unit_value_cents, sum(e.amount)::integer as available
    from public.token_grants g
    join public.token_accounts a on a.member_id = g.member_id
    join public.ledger_entries e on e.grant_id = g.id and e.account_id = a.id
    where g.member_id = p_member_id and g.granted_at <= v_now and g.expires_at > v_now
    group by g.id
    having sum(e.amount) > 0
    order by g.expires_at, g.granted_at, g.id
  loop
    v_spend := least(v_remaining, v_grant.available);
    perform public.post_token_pair(v_grant.id, -v_spend, 'spent', 'spend', v_booking.id,
      'spend:' || v_booking.id::text || ':' || v_grant.id::text);
    v_retail_cents := v_retail_cents + v_spend * v_grant.unit_value_cents;
    v_remaining := v_remaining - v_spend;
    exit when v_remaining = 0;
  end loop;

  if v_remaining > 0 then raise exception 'INSUFFICIENT_TOKENS'; end if;

  insert into public.booking_requests (member_id, idempotency_key, booking_id)
  values (p_member_id, p_idempotency_key, v_booking.id);
  update public.bookings set retail_cents = round(v_retail_cents)::integer where id = v_booking.id;
  update public.sessions set booked_count = booked_count + 1 where id = p_session_id;
  insert into public.booking_events (booking_id, actor_id, event)
  values (v_booking.id, p_member_id, 'confirmed');

  return jsonb_build_object('booking_id', v_booking.id, 'created', true);
end;
$$;

create function public.studio_create_session(
  p_actor_id uuid, p_template_id uuid, p_starts_at timestamptz, p_capacity integer, p_quota integer
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_studio_id uuid;
  v_template_studio_id uuid;
  v_session_id uuid;
begin
  select studio_id into v_studio_id from public.profiles
  where id = p_actor_id and role in ('studio_owner', 'studio_staff');
  if not found then raise exception 'FORBIDDEN'; end if;

  select studio_id into v_template_studio_id from public.class_templates where id = p_template_id;
  if not found then raise exception 'TEMPLATE_NOT_FOUND'; end if;
  if v_template_studio_id <> v_studio_id then raise exception 'FORBIDDEN'; end if;

  if p_starts_at is null or p_starts_at <= clock_timestamp() then
    raise exception 'INVALID_START_TIME';
  end if;
  if p_capacity is null or p_capacity not between 1 and 500 then
    raise exception 'INVALID_CAPACITY';
  end if;
  if p_quota is null or p_quota not between 0 and p_capacity then
    raise exception 'INVALID_QUOTA';
  end if;

  insert into public.sessions (template_id, starts_at, capacity, quota)
  values (p_template_id, p_starts_at, p_capacity, p_quota)
  on conflict (template_id, starts_at) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id into v_session_id from public.sessions
    where template_id = p_template_id and starts_at = p_starts_at
      and capacity = p_capacity and quota = p_quota and status = 'published';
    if not found then raise exception 'SESSION_ALREADY_EXISTS'; end if;
  end if;

  return jsonb_build_object('session_id', v_session_id);
end;
$$;

create function public.studio_update_quota(p_actor_id uuid, p_session_id uuid, p_quota integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_studio_id uuid;
  v_session public.sessions%rowtype;
begin
  select studio_id into v_studio_id from public.profiles
  where id = p_actor_id and role in ('studio_owner', 'studio_staff');
  if not found then raise exception 'FORBIDDEN'; end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  perform 1 from public.class_templates where id = v_session.template_id and studio_id = v_studio_id;
  if not found then raise exception 'FORBIDDEN'; end if;

  if v_session.status <> 'published' or v_session.starts_at <= clock_timestamp() then
    raise exception 'INVALID_SESSION_STATUS';
  end if;
  if p_quota is null or p_quota not between v_session.booked_count and v_session.capacity then
    raise exception 'INVALID_QUOTA';
  end if;

  update public.sessions set quota = p_quota where id = p_session_id;
  return jsonb_build_object('session_id', p_session_id, 'quota', p_quota);
end;
$$;

create function public.check_in(p_actor_id uuid, p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_studio_id uuid;
  v_booking public.bookings%rowtype;
  v_starts_at timestamptz;
begin
  select studio_id into v_studio_id from public.profiles
  where id = p_actor_id and role in ('studio_owner', 'studio_staff');
  if not found then raise exception 'FORBIDDEN'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  select s.starts_at into v_starts_at
  from public.sessions s
  join public.class_templates c on c.id = s.template_id
  where s.id = v_booking.session_id and c.studio_id = v_studio_id and s.status = 'published';
  if not found then raise exception 'FORBIDDEN'; end if;

  if v_booking.status = 'attended' then
    return jsonb_build_object('booking_id', p_booking_id, 'status', 'attended');
  end if;
  if v_booking.status <> 'confirmed' then raise exception 'BOOKING_NOT_CONFIRMED'; end if;
  if v_starts_at > clock_timestamp() + interval '60 minutes' then raise exception 'CHECK_IN_TOO_EARLY'; end if;

  update public.bookings
  set status = 'attended', attended_at = clock_timestamp()
  where id = p_booking_id;
  insert into public.booking_events (booking_id, actor_id, event)
  values (p_booking_id, p_actor_id, 'attended');

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'attended');
end;
$$;

create function public.admin_refund(p_actor_id uuid, p_booking_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_member_id uuid;
  v_refunded integer;
begin
  perform 1 from public.profiles where id = p_actor_id and role = 'admin';
  if not found then raise exception 'FORBIDDEN'; end if;
  if coalesce(length(btrim(p_reason)), 0) not between 5 and 500 then
    raise exception 'REFUND_REASON_REQUIRED';
  end if;

  select member_id into v_member_id from public.bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  perform 1 from public.profiles where id = v_member_id for update;
  select * into strict v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.status = 'cancelled_free' then raise exception 'REFUND_NOT_AVAILABLE'; end if;
  if v_booking.refunded_tokens > 0 then
    return jsonb_build_object('booking_id', p_booking_id, 'refunded_tokens', v_booking.refunded_tokens);
  end if;

  v_refunded := public.refund_booking_tokens(p_booking_id, v_booking.member_id, clock_timestamp());
  if v_refunded <> v_booking.tokens_charged then raise exception 'REFUND_NOT_AVAILABLE'; end if;

  update public.bookings set refunded_tokens = v_refunded where id = p_booking_id;
  insert into public.booking_events (booking_id, actor_id, event, reason)
  values (p_booking_id, p_actor_id, 'admin_refund', btrim(p_reason));
  insert into public.audit_log(actor_id, action, booking_id, reason, details)
  values (p_actor_id, 'admin_refund', p_booking_id, btrim(p_reason),
    jsonb_build_object('previous_refunded_tokens', v_booking.refunded_tokens, 'refunded_tokens', v_refunded));

  return jsonb_build_object('booking_id', p_booking_id, 'refunded_tokens', v_refunded);
end;
$$;

create function public.expire_tokens()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_member record;
  v_grant record;
  v_expired integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  for v_member in
    select p.id
    from public.profiles p
    where exists (
      select 1
      from public.token_grants g
      join public.token_accounts a on a.member_id = g.member_id
      join public.ledger_entries e on e.grant_id = g.id and e.account_id = a.id
      where g.member_id = p.id and g.expires_at <= v_now
      group by g.id
      having sum(e.amount) > 0
    )
    order by p.id
    for update of p skip locked
  loop
    for v_grant in
      select g.id, sum(e.amount)::integer as remaining
      from public.token_grants g
      join public.token_accounts a on a.member_id = g.member_id
      join public.ledger_entries e on e.grant_id = g.id and e.account_id = a.id
      where g.member_id = v_member.id and g.expires_at <= v_now
      group by g.id
      having sum(e.amount) > 0
    loop
      perform public.post_token_pair(v_grant.id, -v_grant.remaining, 'expired', 'expire', null,
        'expire:' || v_grant.id::text);
      v_expired := v_expired + v_grant.remaining;
    end loop;
  end loop;
  return v_expired;
end;
$$;

-- A used token belongs to an attended or late-cancelled booking. Restored tokens
-- are excluded from revenue. The payout calculation counts attended bookings only.
create view public.payout_report with (security_invoker = true) as
with studio_totals as (
  select
    d.id as studio_id,
    d.name as studio_name,
    count(b.id) filter (where b.status = 'attended')::integer as attended_count,
    coalesce(sum(b.payout_cents) filter (where b.status = 'attended'), 0)::integer as payout_cents,
    coalesce(sum(b.tokens_charged - b.refunded_tokens), 0)::integer as used_tokens,
    coalesce(sum(b.retail_cents) filter (where b.refunded_tokens = 0), 0)::integer as revenue_cents
  from public.studios d
  left join public.class_templates c on c.studio_id = d.id
  left join public.sessions s on s.template_id = c.id
  left join public.bookings b on b.session_id = s.id and b.status in ('attended', 'cancelled_late')
  group by d.id, d.name
)
select *, round(revenue_cents::numeric / nullif(used_tokens, 0), 2) as revenue_per_token_cents
from studio_totals;

create function public.refund_booking_tokens(p_booking_id uuid, p_member_id uuid, p_now timestamptz)
returns integer
language plpgsql set search_path = ''
as $$
declare
  v_spend record;
  v_grant_id uuid;
  v_expires_at timestamptz;
  v_refunded integer := 0;
begin
  select period_end into v_expires_at
  from public.subscriptions
  where member_id = p_member_id and status in ('active', 'ending') and period_end > p_now;
  v_expires_at := coalesce(v_expires_at, p_now + interval '7 days');

  for v_spend in
    select g.id, g.unit_value_cents, g.expires_at, -e.amount as tokens
    from public.ledger_entries e
    join public.token_grants g on g.id = e.grant_id
    join public.token_accounts a on a.id = e.account_id and a.member_id = p_member_id
    where e.booking_id = p_booking_id and e.reason = 'spend'
  loop
    v_grant_id := v_spend.id;
    if v_spend.expires_at <= p_now then
      insert into public.token_grants (member_id, source, tokens, unit_value_cents, granted_at, expires_at)
      values (p_member_id, 'refund', v_spend.tokens, v_spend.unit_value_cents, p_now, v_expires_at)
      returning id into v_grant_id;
    end if;
    perform public.post_token_pair(v_grant_id, v_spend.tokens, 'spent', 'refund', p_booking_id,
      'refund:' || p_booking_id::text || ':' || v_spend.id::text);
    v_refunded := v_refunded + v_spend.tokens;
  end loop;
  return v_refunded;
end;
$$;

create function public.cancel_booking(p_member_id uuid, p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_session public.sessions%rowtype;
  v_now timestamptz;
  v_status text := 'cancelled_late';
  v_refunded integer := 0;
begin
  perform 1 from public.profiles where id = p_member_id and role = 'member' for update;
  if not found then raise exception 'FORBIDDEN'; end if;

  select * into v_booking
  from public.bookings where id = p_booking_id and member_id = p_member_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if v_booking.status in ('cancelled_free', 'cancelled_late') then
    return jsonb_build_object('booking_id', v_booking.id, 'status', v_booking.status,
      'refunded_tokens', v_booking.refunded_tokens);
  end if;
  if v_booking.status <> 'confirmed' then raise exception 'BOOKING_NOT_CONFIRMED'; end if;

  select * into strict v_session from public.sessions where id = v_booking.session_id for update;
  v_now := clock_timestamp();
  if v_session.starts_at <= v_now then raise exception 'SESSION_ALREADY_STARTED'; end if;

  v_refunded := v_booking.refunded_tokens;
  if v_session.starts_at >= v_now + interval '24 hours' then
    v_status := 'cancelled_free';
    if v_refunded = 0 then
      v_refunded := public.refund_booking_tokens(v_booking.id, p_member_id, v_now);
    end if;
  end if;

  update public.bookings set status = v_status, refunded_tokens = v_refunded, cancelled_at = v_now
  where id = p_booking_id;
  update public.sessions set booked_count = booked_count - 1 where id = v_booking.session_id;
  insert into public.booking_events (booking_id, actor_id, event, reason)
  values (p_booking_id, p_member_id, v_status, 'member_cancellation');

  return jsonb_build_object('booking_id', p_booking_id, 'status', v_status, 'refunded_tokens', v_refunded);
end;
$$;

-- AvoPore derives the actor identity from the verified server-side session and
-- calls the database as a trusted backend. Browser roles cannot call these
-- functions, including by passing an arbitrary actor ID to PostgREST.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'studios', 'profiles', 'demo_credentials', 'class_templates', 'sessions',
    'plans', 'subscriptions', 'consents', 'checkout_attempts', 'billing_cycles',
    'bookings', 'booking_requests', 'booking_events', 'token_accounts',
    'token_grants', 'ledger_entries', 'audit_log'
  ]
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', v_table);
    execute format('alter table public.%I enable row level security', v_table);
    execute format('grant select on table public.%I to service_role', v_table);
    execute format('create policy service_read on public.%I for select to service_role using (true)', v_table);
  end loop;
end;
$$;

grant insert on table public.consents to service_role;
create policy service_insert_consent on public.consents
for insert to service_role with check (true);

grant insert, update, delete on table public.checkout_attempts to service_role;
create policy service_write_checkout on public.checkout_attempts
for all to service_role using (true) with check (true);

grant update (status, stripe_customer_id, stripe_subscription_id, period_end, updated_at)
on table public.subscriptions to service_role;
create policy service_sync_subscription on public.subscriptions
for update to service_role using (true) with check (true);

revoke all on sequence public.booking_events_id_seq, public.ledger_entries_id_seq,
  public.audit_log_id_seq from public, anon, authenticated, service_role;

revoke all on table public.payout_report from public, anon, authenticated, service_role;
grant select on table public.payout_report to service_role;

revoke all on function
  public.create_profile_for_auth_user(),
  public.reject_ledger_mutation(),
  public.check_ledger_pair(),
  public.post_token_pair(uuid, integer, text, text, uuid, text),
  public.refund_booking_tokens(uuid, uuid, timestamptz),
  public.token_balance(uuid),
  public.issue_cycle(uuid, text, text, integer, timestamptz, timestamptz, text, text),
  public.book_session(uuid, uuid, text),
  public.cancel_booking(uuid, uuid),
  public.studio_create_session(uuid, uuid, timestamptz, integer, integer),
  public.studio_update_quota(uuid, uuid, integer),
  public.check_in(uuid, uuid),
  public.admin_refund(uuid, uuid, text),
  public.expire_tokens()
from public, anon, authenticated, service_role;

grant execute on function
  public.token_balance(uuid),
  public.issue_cycle(uuid, text, text, integer, timestamptz, timestamptz, text, text),
  public.book_session(uuid, uuid, text),
  public.cancel_booking(uuid, uuid),
  public.studio_create_session(uuid, uuid, timestamptz, integer, integer),
  public.studio_update_quota(uuid, uuid, integer),
  public.check_in(uuid, uuid),
  public.admin_refund(uuid, uuid, text),
  public.expire_tokens()
to service_role;
