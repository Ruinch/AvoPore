const defaultTimezone = 'America/New_York'

function localClock(timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

function inputValue(date: Date, clock: Intl.DateTimeFormat) {
  const parts = Object.fromEntries(clock.formatToParts(date).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function dateTimeInputValue(date: Date, timezone = defaultTimezone) {
  return inputValue(date, localClock(timezone))
}

export function parseStudioDateTime(value: string, timezone = defaultTimezone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null

  const wallTime = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(wallTime)) return null

  const clock = localClock(timezone)
  const oneDay = 24 * 60 * 60 * 1000
  const probes = [wallTime - oneDay, wallTime + oneDay]
  for (const probe of probes) {
    const localTime = Date.parse(`${inputValue(new Date(probe), clock)}:00Z`)
    const candidate = new Date(wallTime + (probe - localTime))
    if (inputValue(candidate, clock) === value) return candidate
  }

  return null
}

export function formatSessionTime(value: Date | string, timezone = defaultTimezone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
