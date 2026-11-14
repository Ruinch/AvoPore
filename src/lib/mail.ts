type BookingConfirmation = {
  to: string;
  name: string;
  className: string;
  studioName: string;
  startsAt: string | Date;
  timezone: string;
  bookingId: string;
};

export async function sendBookingConfirmation(confirmation: BookingConfirmation) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey && !from) return;
  if (!apiKey || !from) throw new Error('Booking email requires RESEND_API_KEY and RESEND_FROM_EMAIL.');

  const { to, name, className, studioName, startsAt, timezone, bookingId } = confirmation;
  const starts = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full', timeStyle: 'short', timeZone: timezone,
  }).format(new Date(startsAt));
  const text = [
    `Hi ${name},`,
    `Your spot for ${className} is confirmed.`,
    `${studioName}\n${starts} (${timezone})\nBooking reference ${bookingId}`,
    'You can manage your reservation from My bookings. Cancel at least 24 hours before class to get your tokens back.',
    'See you in the studio,\nAvoPore',
  ].join('\n\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `booking-confirmation/${bookingId}`,
    },
    body: JSON.stringify({ from, to: [to], subject: `Your AvoPore booking for ${className}`, text }),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Booking confirmation could not be sent (HTTP ${response.status}).`);
}
