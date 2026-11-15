import { query } from "@/lib/db";

export type OwnerPeriod = 7 | 30 | 90;

export type OwnerMetrics = {
  days: OwnerPeriod;
  payments: {
    cycles: number;
    grossCents: number;
    payingMembers: number;
    activeMembers: number;
    testStripeCents: number;
    simulatedCents: number;
  };
  bookings: {
    created: number;
    attended: number;
    cancelled: number;
    pendingCheckins: number;
    studioPayoutCents: number;
    usedTokens: number;
    revenueCents: number;
  };
  upcoming: { sessions: number; quota: number; booked: number; full: number };
  studios: {
    id: string;
    name: string;
    neighborhood: string;
    attended: number;
    payoutCents: number;
    upcomingSessions: number;
    upcomingQuota: number;
    upcomingBooked: number;
    pendingCheckins: number;
  }[];
  trend: { day: string; grossCents: number; attended: number }[];
};

// A single read takes one snapshot of the selected NYC calendar period and
// point-in-time counts. Pending check-ins and upcoming inventory use that same clock.
export async function getOwnerMetrics(days: OwnerPeriod): Promise<OwnerMetrics> {
  const [row] = await query<{ metrics: OwnerMetrics }>(`
    with bounds as (
      select now() as as_of,
        ((now() at time zone 'America/New_York')::date - ($1::int - 1)) as first_day,
        (((now() at time zone 'America/New_York')::date - ($1::int - 1))::timestamp
          at time zone 'America/New_York') as from_ts
    ),
    days_in_period as (
      select first_day + offset_day as day
      from bounds cross join generate_series(0, $1::int - 1) as offsets(offset_day)
    ),
    period_payments as (
      select c.member_id, c.amount_cents,
        (c.created_at at time zone 'America/New_York')::date as day,
        case
          when starts_with(c.payment_ref, 'demo:') then 'simulated'
          when starts_with(c.payment_ref, 'in_') or c.stripe_subscription_id is not null then 'stripe_test'
        end as source
      from public.billing_cycles c cross join bounds
      where c.created_at >= from_ts and c.created_at <= as_of
    ),
    payment_totals as (
      select count(*) as cycles,
        coalesce(sum(amount_cents), 0) as gross_cents,
        count(distinct member_id) as paying_members,
        coalesce(sum(amount_cents) filter (where source = 'stripe_test'), 0) as stripe_cents,
        coalesce(sum(amount_cents) filter (where source = 'simulated'), 0) as simulated_cents
      from period_payments
    ),
    current_members as (
      select count(*) as active_members
      from public.subscriptions s
      join public.profiles p on p.id = s.member_id
      cross join bounds
      where p.role = 'member' and s.status in ('active', 'ending') and s.period_end > as_of
    ),
    booking_activity as (
      select count(*) filter (where b.created_at between from_ts and as_of) as created,
        count(*) filter (
          where b.status in ('cancelled_free', 'cancelled_late') and b.cancelled_at between from_ts and as_of
        ) as cancelled
      from public.bookings b cross join bounds
    ),
    period_attendance as (
      select t.studio_id, b.payout_cents,
        (b.attended_at at time zone 'America/New_York')::date as day,
        b.tokens_charged - b.refunded_tokens as used_tokens,
        round(b.retail_cents::numeric * (b.tokens_charged - b.refunded_tokens) / b.tokens_charged) as revenue_cents
      from public.bookings b
      join public.sessions s on s.id = b.session_id
      join public.class_templates t on t.id = s.template_id
      cross join bounds
      where b.status = 'attended' and b.attended_at between from_ts and as_of
    ),
    attended_by_studio as (
      select studio_id, count(*) as attended, sum(payout_cents) as payout_cents,
        sum(used_tokens) as used_tokens, sum(revenue_cents) as revenue_cents
      from period_attendance
      group by studio_id
    ),
    attendance_totals as (
      select coalesce(sum(attended), 0) as attended, coalesce(sum(payout_cents), 0) as payout_cents,
        coalesce(sum(used_tokens), 0) as used_tokens, coalesce(sum(revenue_cents), 0) as revenue_cents
      from attended_by_studio
    ),
    checkins_by_studio as (
      select t.studio_id, count(*) as pending_checkins
      from public.bookings b
      join public.sessions s on s.id = b.session_id
      join public.class_templates t on t.id = s.template_id
      cross join bounds
      where b.status = 'confirmed' and s.status = 'published' and s.starts_at <= as_of
      group by t.studio_id
    ),
    inventory_by_studio as (
      select t.studio_id, count(*) as upcoming_sessions, sum(s.quota) as upcoming_quota,
        sum(s.booked_count) as upcoming_booked,
        count(*) filter (where s.quota > 0 and s.booked_count >= s.quota) as full_sessions
      from public.sessions s
      join public.class_templates t on t.id = s.template_id
      cross join bounds
      where s.status = 'published' and s.starts_at > as_of
      group by t.studio_id
    ),
    inventory_totals as (
      select coalesce(sum(upcoming_sessions), 0) as sessions, coalesce(sum(upcoming_quota), 0) as quota,
        coalesce(sum(upcoming_booked), 0) as booked, coalesce(sum(full_sessions), 0) as full_sessions
      from inventory_by_studio
    ),
    cash_by_day as (
      select day, sum(amount_cents) as gross_cents from period_payments group by day
    ),
    attendance_by_day as (
      select day, count(*) as attended from period_attendance group by day
    )
    select jsonb_build_object(
      'days', $1::int,
      'payments', jsonb_build_object(
        'cycles', p.cycles,
        'grossCents', p.gross_cents,
        'payingMembers', p.paying_members,
        'activeMembers', m.active_members,
        'testStripeCents', p.stripe_cents,
        'simulatedCents', p.simulated_cents
      ),
      'bookings', jsonb_build_object(
        'created', b.created,
        'attended', a.attended,
        'cancelled', b.cancelled,
        'pendingCheckins', (select coalesce(sum(pending_checkins), 0) from checkins_by_studio),
        'studioPayoutCents', a.payout_cents,
        'usedTokens', a.used_tokens,
        'revenueCents', a.revenue_cents
      ),
      'upcoming', jsonb_build_object(
        'sessions', i.sessions, 'quota', i.quota, 'booked', i.booked, 'full', i.full_sessions
      ),
      'studios', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'neighborhood', s.neighborhood,
          'attended', coalesce(st.attended, 0),
          'payoutCents', coalesce(st.payout_cents, 0),
          'upcomingSessions', coalesce(si.upcoming_sessions, 0),
          'upcomingQuota', coalesce(si.upcoming_quota, 0),
          'upcomingBooked', coalesce(si.upcoming_booked, 0),
          'pendingCheckins', coalesce(sc.pending_checkins, 0)
        ) order by s.name, s.id)
        from public.studios s
        left join attended_by_studio st on st.studio_id = s.id
        left join inventory_by_studio si on si.studio_id = s.id
        left join checkins_by_studio sc on sc.studio_id = s.id
      ), '[]'::jsonb),
      'trend', (
        select jsonb_agg(jsonb_build_object(
          'day', to_char(t.day, 'YYYY-MM-DD'),
          'grossCents', coalesce(c.gross_cents, 0),
          'attended', coalesce(v.attended, 0)
        ) order by t.day)
        from days_in_period t
        left join cash_by_day c on c.day = t.day
        left join attendance_by_day v on v.day = t.day
      )
    ) as metrics
    from payment_totals p
    cross join current_members m
    cross join booking_activity b
    cross join attendance_totals a
    cross join inventory_totals i
  `, [days]);
  return row.metrics;
}
