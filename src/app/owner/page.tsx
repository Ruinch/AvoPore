import Link from "next/link";
import { ArrowUpRight, Banknote, CalendarCheck, Download, Users, Wallet } from "lucide-react";
import { OwnerPilotCalculator } from "@/components/owner-pilot-calculator";
import { requireUser } from "@/lib/auth";
import { dollars } from "@/lib/catalog";
import { getOwnerMetrics } from "@/lib/owner-metrics";
import { ownerPeriods, readOwnerPeriod } from "@/lib/owner-period";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner dashboard" };

const count = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const money = (cents: number) => dollars(cents, 2);
const quantity = (amount: number, noun: string) => count.format(amount) + " " + noun + (amount === 1 ? "" : "s");
const displayDate = (day: string) => date.format(new Date(day + "T12:00:00Z"));

type Results = Awaited<ReturnType<typeof getOwnerMetrics>>;
type TrendPoint = Results["trend"][number];

function groupTrend(trend: TrendPoint[], days: number) {
  const step = days === 90 ? 7 : days === 30 ? 3 : 1;
  const groups: Array<{ day: string; lastDay: string; grossCents: number; attended: number }> = [];
  for (let index = 0; index < trend.length; index += step) {
    const chunk = trend.slice(index, index + step);
    groups.push({
      day: chunk[0].day,
      lastDay: chunk[chunk.length - 1].day,
      grossCents: chunk.reduce((total, row) => total + row.grossCents, 0),
      attended: chunk.reduce((total, row) => total + row.attended, 0),
    });
  }
  return groups;
}

function ActivityBars({ groups, value, label, format }: {
  groups: ReturnType<typeof groupTrend>;
  value: "grossCents" | "attended";
  label: string;
  format: (value: number) => string;
}) {
  const max = Math.max(0, ...groups.map((group) => group[value]));
  const sum = groups.reduce((total, group) => total + group[value], 0);
  return <figure className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
    <figcaption className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <strong className="text-sm tabular-nums">{format(sum)}</strong>
    </figcaption>
    {max > 0 ? <ol className="mt-4 flex h-24 items-end gap-1.5 border-b border-[var(--line)]" aria-label={label}>
      {groups.map((group) => {
        const range = group.day === group.lastDay ? displayDate(group.day) : displayDate(group.day) + " to " + displayDate(group.lastDay);
        const amount = group[value];
        return <li key={group.day} title={range + " · " + format(amount)} className="flex h-full min-w-0 flex-1 items-end">
          <span className="sr-only">{range} · {format(amount)}</span>
          <span aria-hidden="true" className={"w-full rounded-t " + (value === "grossCents" ? "bg-[#476958]" : "bg-[#ad4b31]")}
            style={{ height: amount ? Math.max(5, (amount / max) * 100) + "%" : "0%" }} />
        </li>;
      })}
    </ol> : <p className="muted flex h-24 items-center text-sm">No activity in this period.</p>}
    {groups.length > 1 && <div className="muted mt-2 flex justify-between text-xs" aria-hidden="true">
      <span>{displayDate(groups[0].day)}</span><span>{displayDate(groups[groups.length - 1].lastDay)}</span>
    </div>}
  </figure>;
}

export default async function OwnerPage({ searchParams }: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requireUser("admin");
  const days = readOwnerPeriod((await searchParams).days);
  const { payments, bookings, upcoming, studios, trend } = await getOwnerMetrics(days);
  const groups = groupTrend(trend, days);
  const cards = [
    { label: "Test & demo receipts", amount: money(payments.grossCents), detail: money(payments.testStripeCents) + " Stripe test · " + money(payments.simulatedCents) + " simulated", icon: Banknote },
    { label: "Active memberships", amount: count.format(payments.activeMembers), detail: "Active today · " + quantity(payments.payingMembers, "purchaser") + " in period", icon: Users },
    { label: "Attended visits", amount: count.format(bookings.attended), detail: quantity(bookings.created, "booking") + " placed · " + count.format(bookings.cancelled) + " cancelled", icon: CalendarCheck },
    { label: "Calculated studio payouts", amount: money(bookings.studioPayoutCents), detail: bookings.attended > 0 ? money(bookings.studioPayoutCents / bookings.attended) + " per attended visit" : "Based on confirmed attendance", icon: Wallet },
  ];
  const spread = bookings.revenueCents - bookings.studioPayoutCents;

  return <section className="shell space-y-7 py-10 sm:py-14">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2!">AvoPore operations</p>
        <h1 className="display text-4xl sm:text-6xl">Owner dashboard</h1>
        <p className="muted mt-3 text-sm">New York time · {trend.length ? displayDate(trend[0].day) + " to " + displayDate(trend[trend.length - 1].day) : "Last " + days + " days"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin" className="button button-secondary">Manage bookings <ArrowUpRight size={15} aria-hidden /></Link>
        <a className="button button-primary" href={"/owner/report?days=" + days} download><Download size={16} aria-hidden /> Studio CSV</a>
      </div>
    </header>

    <nav aria-label="Reporting period" className="flex flex-wrap gap-2">
      {ownerPeriods.map((period) => <Link key={period} href={"/owner?days=" + period}
        aria-current={period === days ? "page" : undefined}
        className={"rounded-full border px-4 py-2 text-sm font-semibold " + (period === days ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-[var(--white)] hover:border-[var(--ink)]")}>
        {period} days
      </Link>)}
    </nav>

    <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, amount, detail, icon: Icon }) => <div className="panel min-w-0 p-4 sm:p-5" key={label}>
        <dt className="flex items-center gap-2 text-sm font-semibold"><Icon className="shrink-0 text-[var(--rust)]" size={17} aria-hidden />{label}</dt>
        <dd className="display mt-3! text-3xl sm:text-4xl tabular-nums">{amount}</dd>
        <dd className="muted mt-2 text-xs leading-relaxed">{detail}</dd>
      </div>)}
    </dl>

    <section className="panel p-4 sm:p-6" aria-labelledby="owner-activity">
      <h2 className="display text-3xl" id="owner-activity">Activity over time</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ActivityBars groups={groups} value="grossCents" label="Test & demo receipts" format={money} />
        <ActivityBars groups={groups} value="attended" label="Attended visits" format={(v) => count.format(v)} />
      </div>
      <dl className="mt-4 grid gap-3 rounded-xl bg-[var(--sage)] p-4 sm:grid-cols-3">
        <div><dt className="muted text-xs">Allocated revenue from attended visits</dt><dd className="mt-1 font-semibold tabular-nums">{money(bookings.revenueCents)}</dd></div>
        <div><dt className="muted text-xs">Tokens used on attended visits</dt><dd className="mt-1 font-semibold tabular-nums">{count.format(bookings.usedTokens)}</dd></div>
        <div><dt className="muted text-xs">After studio payouts</dt><dd className={"mt-1 font-semibold tabular-nums " + (spread < 0 ? "text-[var(--rust)]" : "")}>{money(spread)}</dd></div>
      </dl>
      <p className="muted mt-3 text-xs">Receipt dates follow the recorded payment. Visit revenue follows studio check-in and reflects redeemed token value. The figure after studio payouts is before fees and operating expenses.</p>
    </section>

    <section className="panel p-4 sm:p-6" aria-labelledby="owner-studios">
      <h2 className="display text-3xl" id="owner-studios">Studio operations</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="muted text-xs">Upcoming sessions</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count.format(upcoming.sessions)}</dd></div>
        <div><dt className="muted text-xs">Upcoming seats booked</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count.format(upcoming.booked)} / {count.format(upcoming.quota)}</dd></div>
        <div><dt className="muted text-xs">Full sessions</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count.format(upcoming.full)}</dd></div>
        <div><dt className="muted text-xs">Check-ins due</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count.format(bookings.pendingCheckins)}</dd></div>
      </dl>
      <p className="muted mt-3 text-xs">Upcoming inventory and overdue check-ins are current snapshots. Visits and payouts follow the selected period.</p>
      {studios.length ? <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Studio metrics">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead className="muted border-b border-[var(--line)]">
            <tr><th scope="col" className="py-3 text-left">Studio</th><th scope="col" className="px-2 py-3 text-right">Visits</th>
              <th scope="col" className="px-2 py-3 text-right">Payouts</th><th scope="col" className="px-2 py-3 text-right">Upcoming sessions</th>
              <th scope="col" className="px-2 py-3 text-right">Seats booked</th><th scope="col" className="py-3 pl-2 text-right">Check-ins due</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {studios.map((studio) => <tr key={studio.id}>
              <th scope="row" className="py-3 text-left font-semibold">{studio.name}<span className="muted block text-xs font-normal">{studio.neighborhood}</span></th>
              <td className="px-2 py-3 text-right tabular-nums">{count.format(studio.attended)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{money(studio.payoutCents)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{count.format(studio.upcomingSessions)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{count.format(studio.upcomingBooked)} / {count.format(studio.upcomingQuota)}</td>
              <td className={"py-3 pl-2 text-right tabular-nums " + (studio.pendingCheckins ? "font-semibold text-[var(--rust)]" : "")}>{count.format(studio.pendingCheckins)}</td>
            </tr>)}
          </tbody>
        </table>
      </div> : <p className="muted mt-4 text-sm">Studio metrics appear when a studio is added.</p>}
    </section>

    <OwnerPilotCalculator />
  </section>;
}
