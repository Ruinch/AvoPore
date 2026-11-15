import Link from "next/link"
import { SubmitButton } from '@/components/submit-button'
import { requireUser } from '@/lib/auth'
import { dollars } from '@/lib/catalog'
import { query } from '@/lib/db'
import { formatSessionTime } from '../studio/local-time'
import { refundBooking } from './actions'
import { adminFeedback } from './feedback'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin dashboard' }

type Booking = {
  id: string
  status: 'confirmed' | 'attended' | 'cancelled_free' | 'cancelled_late'
  tokens_charged: number
  refunded_tokens: number
  starts_at: Date | string
  title: string
  studio_name: string
  full_name: string | null
  email: string
}

type ReportLine = {
  studio_id: string
  studio_name: string
  attended_count: number | string
  payout_cents: number | string
  used_tokens: number | string
  revenue_cents: number | string
  revenue_per_token_cents: number | string | null
}

const statuses: Record<Booking['status'], string> = {
  confirmed: 'Confirmed',
  attended: 'Attended',
  cancelled_free: 'Cancelled',
  cancelled_late: 'Late cancellation',
}

const money = (cents: number | string) => dollars(Number(cents), 2)

type Search = { booking?: string; feedback?: string }

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser('admin')
  const { booking: bookingId, feedback } = await searchParams
  const [bookings, report] = await Promise.all([
    query<Booking>(`
      select b.id, b.status, b.tokens_charged, b.refunded_tokens, s.starts_at, t.title,
             st.name as studio_name, p.full_name, p.email
      from bookings b
      join profiles p on p.id = b.member_id
      join sessions s on s.id = b.session_id
      join class_templates t on t.id = s.template_id
      join studios st on st.id = t.studio_id
      order by b.created_at desc, b.id desc
    `),
    query<ReportLine>(`
      select studio_id, studio_name, attended_count, payout_cents, used_tokens, revenue_cents, revenue_per_token_cents
      from payout_report
      order by studio_name
    `),
  ])

  const totals = report.reduce((sum, line) => ({
    visits: sum.visits + Number(line.attended_count),
    payouts: sum.payouts + Number(line.payout_cents),
    tokens: sum.tokens + Number(line.used_tokens),
    revenue: sum.revenue + Number(line.revenue_cents),
  }), { visits: 0, payouts: 0, tokens: 0, revenue: 0 })

  const message = feedback && Object.hasOwn(adminFeedback, feedback)
    ? adminFeedback[feedback as keyof typeof adminFeedback]
    : null
  const notice = message && (
    <p id="admin-feedback" className={`notice my-3 ${feedback === 'refunded' ? '' : 'notice-error'}`} role={feedback === 'refunded' ? 'status' : 'alert'}>
      {message}
    </p>
  )

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="display text-4xl sm:text-6xl">Admin dashboard</h1>
        <Link className="text-link mt-3" href="/owner">Owner dashboard</Link>
      </header>

      {(!bookingId || !bookings.some((booking) => booking.id === bookingId)) && notice}

      <section className="panel p-5 sm:p-7" aria-labelledby="payouts-heading">
        <h2 className="display text-3xl" id="payouts-heading">Studio payouts</h2>
        <p className="muted mt-2 text-sm">Each check-in uses the studio rate saved when the booking was made.</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-[#edf0e7] p-4 sm:grid-cols-4 sm:p-5">
          <div>
            <dt className="muted text-sm">Attendance</dt>
            <dd className="display mt-1 break-words text-2xl tabular-nums sm:text-3xl">{totals.visits}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Calculated payouts</dt>
            <dd className="display mt-1 break-words text-2xl tabular-nums sm:text-3xl">{money(totals.payouts)}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Tokens used</dt>
            <dd className="display mt-1 break-words text-2xl tabular-nums sm:text-3xl">{totals.tokens}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Revenue per token used</dt>
            <dd className="display mt-1 break-words text-2xl tabular-nums sm:text-3xl">{totals.tokens ? money(totals.revenue / totals.tokens) : '—'}</dd>
          </div>
        </dl>

        {report.length > 0 && (
          <div className="mt-5 overflow-x-auto" tabIndex={0} aria-label="Payouts by studio" role="region">
            <p className="muted text-sm md:hidden">Scroll across to see revenue by studio.</p>
            <table className="min-w-[39rem] w-full border-collapse text-left text-sm">
              <thead className="muted border-b border-[#172c24]/15">
                <tr>
                  <th scope="col" className="py-3 pr-4 font-semibold">Studio</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Attendance</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Payout</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Tokens used</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Revenue</th>
                  <th scope="col" className="pl-3 py-3 text-right font-semibold">Revenue / token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172c24]/15">
                {report.map((line) => (
                  <tr key={line.studio_id}>
                    <th scope="row" className="py-3 pr-4 font-semibold">{line.studio_name}</th>
                    <td className="px-3 py-3 text-right tabular-nums">{line.attended_count}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(line.payout_cents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{line.used_tokens}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(line.revenue_cents)}</td>
                    <td className="pl-3 py-3 text-right tabular-nums">{line.revenue_per_token_cents == null ? '—' : money(line.revenue_per_token_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel mt-6 p-5 sm:p-7" aria-labelledby="bookings-heading">
        <h2 className="display text-3xl" id="bookings-heading">Bookings</h2>
        {bookings.length === 0 ? <p className="muted mt-4">Bookings will appear here as members reserve sessions.</p> : (
          <ul className="mt-5 divide-y divide-[#172c24]/15 border-y border-[#172c24]/15">
            {bookings.map((booking) => (
              <li key={booking.id} id={`booking-${booking.id}`} className="scroll-mt-24 py-4">
                {bookingId === booking.id && notice}
                <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                  <div>
                    <p className="text-sm font-semibold">{booking.title}</p>
                    <p className="muted mt-1 text-sm">{booking.studio_name} · {formatSessionTime(booking.starts_at)}</p>
                  </div>
                  <div>
                    <p className="break-words text-sm font-semibold">{booking.full_name || booking.email}</p>
                    {booking.full_name && <p className="muted mt-1 break-all text-sm">{booking.email}</p>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{statuses[booking.status]}</p>
                    <p className="muted mt-1 text-sm tabular-nums">
                      {booking.tokens_charged} tokens charged{booking.refunded_tokens ? ` · ${booking.refunded_tokens} returned` : ''}
                    </p>
                    {booking.status !== 'cancelled_free' && booking.tokens_charged > booking.refunded_tokens && (
                      <details className="mt-2">
                        <summary className="w-fit cursor-pointer text-sm font-semibold underline underline-offset-4">Refund tokens</summary>
                        <form action={refundBooking} className="mt-3 grid gap-2">
                          <input name="bookingId" type="hidden" value={booking.id} />
                          <label className="field">
                            Reason for the audit log
                            <textarea name="reason" minLength={5} maxLength={500} rows={2} required />
                          </label>
                          <div className="justify-self-start"><SubmitButton secondary pendingText="Issuing refund…">Confirm refund</SubmitButton></div>
                        </form>
                      </details>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
