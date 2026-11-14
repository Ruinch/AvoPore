'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { rpc } from '@/lib/db'
import { studioFeedback } from './feedback'
import { parseStudioDateTime } from './local-time'

function formId(data: FormData, field: string) {
  const value = data.get(field)
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function integer(data: FormData, field: string) {
  const value = data.get(field)
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed <= 2147483647 ? parsed : null
}

function studioRedirect(feedback: string, sessionId?: string | null): never {
  const params = new URLSearchParams({ feedback })
  if (sessionId) params.set('session', sessionId)
  redirect(`/studio?${params}#${sessionId ? 'roster' : 'studio-feedback'}`)
}

function studioFailure(error: unknown, sessionId?: string | null): never {
  const code = error instanceof Error ? error.message : ''
  studioRedirect(Object.hasOwn(studioFeedback, code) ? code : 'unknown_error', sessionId)
}

export async function createSession(data: FormData) {
  const user = await requireUser('studio')
  const templateId = formId(data, 'templateId')
  const value = data.get('startsAt')
  const startsAt = typeof value === 'string' ? parseStudioDateTime(value) : null
  const capacity = integer(data, 'capacity')
  const quota = integer(data, 'quota')

  if (!templateId) studioRedirect('TEMPLATE_NOT_FOUND')
  if (!startsAt || startsAt.getTime() <= Date.now()) studioRedirect('INVALID_START_TIME')
  if (capacity === null || capacity < 1 || capacity > 500) studioRedirect('INVALID_CAPACITY')
  if (quota === null || quota > capacity) studioRedirect('INVALID_QUOTA')

  let result: { session_id: string }
  try {
    result = await rpc('studio_create_session', {
      p_actor_id: user.id,
      p_template_id: templateId,
      p_starts_at: startsAt.toISOString(),
      p_capacity: capacity,
      p_quota: quota,
    })
  } catch (error) {
    studioFailure(error)
  }

  revalidatePath('/studio')
  revalidatePath('/discover', 'layout')
  revalidatePath('/')
  studioRedirect('created', result.session_id)
}

export async function updateQuota(data: FormData) {
  const user = await requireUser('studio')
  const sessionId = formId(data, 'sessionId')
  const quota = integer(data, 'quota')
  if (!sessionId) studioRedirect('SESSION_NOT_FOUND')
  if (quota === null) studioRedirect('INVALID_QUOTA', sessionId)

  try {
    await rpc('studio_update_quota', {
      p_actor_id: user.id,
      p_session_id: sessionId,
      p_quota: quota,
    })
  } catch (error) {
    studioFailure(error, sessionId)
  }

  revalidatePath('/studio')
  revalidatePath('/discover', 'layout')
  revalidatePath('/')
  studioRedirect('quota', sessionId)
}

export async function markAttendance(data: FormData) {
  const user = await requireUser('studio')
  const sessionId = formId(data, 'sessionId')
  const bookingId = formId(data, 'bookingId')
  if (!bookingId) studioRedirect('BOOKING_NOT_FOUND', sessionId)

  try {
    await rpc('check_in', { p_actor_id: user.id, p_booking_id: bookingId })
  } catch (error) {
    studioFailure(error, sessionId)
  }

  revalidatePath('/studio')
  revalidatePath('/admin')
  revalidatePath('/account')
  studioRedirect('attended', sessionId)
}
