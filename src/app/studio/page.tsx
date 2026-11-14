import Link from 'next/link'
import { SubmitButton } from '@/components/submit-button'
import { requireUser } from '@/lib/auth'
import { dollars } from '@/lib/catalog'
import { query } from '@/lib/db'
import { createSession, markAttendance, updateQuota } from './actions'
import { studioFeedback, studioSuccess } from './feedback'
import { dateTimeInputValue, formatSessionTime } from './local-time'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Studio dashboard' }

type Studio = { name: string; neighborhood: string }
type Template = { id: string; title: string }
type Session = {
  id: string
  title: string
  starts_at: Date | string
  status: 'published' | 'cancelled'
  capacity: number
  quota: number
  booked_count: number
}
type Booking = {
  id: string
  full_name: string | null
  email: string
  status: 'confirmed' | 'attended' | 'cancelled_free' | 'cancelled_late'
}
type Statement = { attended_count: number | string; payout_cents: number | string }

const statuses: Record<Booking['status'], string> = {
  confirmed: 'Confirmed',
  attended: 'Attended',
  cancelled_free: 'Cancelled',
  cancelled_late: 'Late cancellation',
}

type Search = { session?: string; feedback?: string }

export default async function StudioPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser('studio')
  if (!user.studioId) {
    return (
      <div className="shell py-14">
        <h1 className="display text-4xl">Studio dashboard</h1>
        <p className="notice mt-6">Your account needs a studio assignment before you can manage a schedule.</p>
      </div>
    )
  }

  const { session: sessionId, feedback } = await searchParams
  const params = [user.studioId]
  const [[studio], templates, sessions, [statement]] = await Promise.all([
    query<Studio>('select name, neighborhood from studios where id = $1', params),
    query<Template>('select id, title from class_templates where studio_id = $1 order by title', params),
    query<Session>(`
      select s.id, t.title, s.starts_at, s.status, s.capacity, s.quota, s.booked_count
      from sessions s join class_templates t on t.id = s.template_id
      where t.studio_id = $1
      order by (s.starts_at < now()), case when s.starts_at >= now() then s.starts_at end, s.starts_at desc
    `, params),
    query<Statement>('select attended_count, payout_cents from payout_report where studio_id = $1', params),
  ])

  const selected = sessions.find((session) => session.id === sessionId) ?? sessions[0]
  const roster = selected ? await query<Booking>(`
    select b.id, p.full_name, p.email, b.status
    from bookings b
    join profiles p on p.id = b.member_id
    join sessions s on s.id = b.session_id
    join class_templates t on t.id = s.template_id
    where b.session_id = $1 and t.studio_id = $2
    order by b.created_at, b.id
  `, [selected.id, user.studioId]) : []

  const now = Date.now()
  const start = selected ? new Date(selected.starts_at).getTime() : 0
  const published = selected?.status === 'published'
  const checkInOpen = published && now >= start - 60 * 60 * 1000
  const quotaEditable = published && now < start
  const message = feedback && Object.hasOwn(studioFeedback, feedback)
    ? studioFeedback[feedback as keyof typeof studioFeedback]
    : null
  const successful = studioSuccess.has(feedback ?? '')
  const notice = message && (
    <p id="studio-feedback" className={`notice mb-5 ${successful ? '' : 'notice-error'}`} role={successful ? 'status' : 'alert'}>
      {message}
    </p>
  )

  return (
    <div className="shell py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow">Studio dashboard</p>
        <h1 className="display mt-2 text-4xl sm:text-6xl">{studio?.name ?? 'Your studio'}</h1>
        {studio && <p className="muted mt-3">{studio.neighborhood} · New York</p>}
      </header>

      <section aria-label="Payout statement" className="panel mb-8 grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 sm:items-center sm:p-7">
        <div className="col-span-2 sm:col-span-1">
          <h2 className="display text-2xl">Payout statement</h2>
          <p className="muted mt-1 text-sm">All recorded sessions</p>
        </div>
        <div>
          <p className="muted text-sm">Attendees checked in</p>
          <p className="display text-3xl tabular-nums">{Number(statement?.attended_count ?? 0)}</p>
        </div>
        <div>
          <p className="muted text-sm">Calculated payout</p>
          <p className="display text-3xl tabular-nums">{dollars(Number(statement?.payout_cents ?? 0), 2)}</p>
        </div>
      </section>

      {!sessionId && notice}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid gap-6">
          <section className="panel p-5 sm:p-7" aria-labelledby="publish-heading">
            <h2 id="publish-heading" className="display text-3xl">Publish a session</h2>
            {templates.length === 0 ? <p className="muted mt-4">Your studio has no class templates yet.</p> : (
              <form action={createSession} className="mt-5 grid gap-4">
                <div className="field">
                  <label htmlFor="studio-template">Class</label>
                  <select id="studio-template" name="templateId" required defaultValue="">
                    <option value="" disabled>Choose a class</option>
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                  </select>
                </div>
                <label className="field">
                  Starts at (New York time)
                  <input name="startsAt" type="datetime-local" min={dateTimeInputValue(new Date(now))} required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    Total capacity
                    <input name="capacity" type="number" min="1" max="500" defaultValue="10" required />
                  </label>
                  <label className="field">
                    AvoPore spots
                    <input name="quota" type="number" min="0" max="500" defaultValue="6" required />
                  </label>
                </div>
                <div className="justify-self-start"><SubmitButton pendingText="Publishing…">Publish session</SubmitButton></div>
              </form>
            )}
          </section>

          <section className="panel p-5 sm:p-7" aria-labelledby="schedule-heading">
            <h2 id="schedule-heading" className="display text-3xl">Your schedule</h2>
            {sessions.length === 0 ? <p className="muted mt-4">Publish your first session to open it for bookings.</p> : (
              <ul className="mt-4 grid gap-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/studio?session=${session.id}#roster`}
                      aria-current={session.id === selected?.id ? 'true' : undefined}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-[#172c24] ${
                        session.id === selected?.id ? 'border-[#172c24] bg-[#edf0e7]' : 'border-[#172c24]/15'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{session.title}</span>
                        <span className="muted mt-1 block text-sm">{formatSessionTime(session.starts_at)}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {session.status === 'cancelled' ? 'Cancelled' : `${session.booked_count}/${session.quota} booked`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section id="roster" className="panel scroll-mt-24 p-5 sm:p-7" aria-labelledby="roster-heading">
          {sessionId && notice}
          <h2 id="roster-heading" className="display text-3xl">Guest list</h2>
          {selected ? (
            <>
              <p className="mt-2 text-lg font-semibold">{selected.title}</p>
              <p className="muted mt-1 text-sm">{formatSessionTime(selected.starts_at)} · {selected.booked_count} of {selected.quota} AvoPore spots booked</p>

              {quotaEditable && (
                <form key={`${selected.id}:${selected.quota}`} action={updateQuota} className="my-5 flex flex-wrap items-end gap-3 border-y border-[#172c24]/15 py-4">
                  <input name="sessionId" type="hidden" value={selected.id} />
                  <label className="field w-36">
                    AvoPore spot quota
                    <input name="quota" type="number" min={selected.booked_count} max={selected.capacity} defaultValue={selected.quota} required />
                  </label>
                  <SubmitButton secondary pendingText="Saving…">Save quota</SubmitButton>
                </form>
              )}

              {roster.length === 0 ? <p className="muted mt-5">No bookings for this session yet.</p> : (
                <>
                  {published && !checkInOpen && <p className="muted mt-5 text-sm">Check-in opens one hour before the session starts.</p>}
                  <ul className="mt-4 divide-y divide-[#172c24]/15 border-y border-[#172c24]/15">
                    {roster.map((booking) => (
                      <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold">{booking.full_name || booking.email}</p>
                          {booking.full_name && <p className="muted break-all text-sm">{booking.email}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="muted text-sm">{statuses[booking.status]}</span>
                          {checkInOpen && booking.status === 'confirmed' && (
                            <form action={markAttendance}>
                              <input name="bookingId" type="hidden" value={booking.id} />
                              <input name="sessionId" type="hidden" value={selected.id} />
                              <SubmitButton secondary pendingText="Checking in…">Check in<span className="sr-only"> {booking.full_name || booking.email}</span></SubmitButton>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : <p className="muted mt-4">Choose a session to view its bookings and manage attendance.</p>}
        </section>
      </div>
    </div>
  )
}
