'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { rpc } from '@/lib/db'
import { adminFeedback } from './feedback'

function adminRedirect(feedback: string, bookingId?: string): never {
  const params = new URLSearchParams({ feedback })
  if (bookingId) params.set('booking', bookingId)
  redirect(`/admin?${params}#${bookingId ? `booking-${bookingId}` : 'admin-feedback'}`)
}

export async function refundBooking(data: FormData) {
  const user = await requireUser('admin')
  const bookingId = data.get('bookingId')
  if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(bookingId)) {
    adminRedirect('BOOKING_NOT_FOUND')
  }

  const value = data.get('reason')
  const reason = typeof value === 'string' ? value.trim() : ''
  if (reason.length < 5 || reason.length > 500) adminRedirect('REFUND_REASON_REQUIRED', bookingId)

  try {
    await rpc('admin_refund', { p_actor_id: user.id, p_booking_id: bookingId, p_reason: reason })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    adminRedirect(Object.hasOwn(adminFeedback, code) ? code : 'unknown_error', bookingId)
  }

  revalidatePath('/admin')
  revalidatePath('/account')
  revalidatePath('/studio')
  adminRedirect('refunded', bookingId)
}
