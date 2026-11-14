const studioTimeZone = 'America/New_York'

const localClock = new Intl.DateTimeFormat('en-US', {
  timeZone: studioTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const sessionClock = new Intl.DateTimeFormat('en-US', {
  timeZone: studioTimeZone,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function dateTimeInputValue(date: Date) {
  const parts = Object.fromEntries(localClock.formatToParts(date).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function parseStudioDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null

  const wallTime = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(wallTime)) return null

  const oneDay = 24 * 60 * 60 * 1000
  const probes = [wallTime - oneDay, wallTime + oneDay]
  for (const probe of probes) {
    const localTime = Date.parse(`${dateTimeInputValue(new Date(probe))}:00Z`)
    const candidate = new Date(wallTime + (probe - localTime))
    if (dateTimeInputValue(candidate) === value) return candidate
  }

  return null
}

export function formatSessionTime(value: Date | string) {
  return sessionClock.format(typeof value === 'string' ? new Date(value) : value)
}
