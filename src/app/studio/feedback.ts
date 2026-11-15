export const studioFeedback = {
  created: 'Session published.',
  quota: 'AvoPore seat quota updated.',
  attended: 'Attendance recorded.',
  FORBIDDEN: 'You do not have access to this session.',
  SESSION_NOT_FOUND: 'This session could not be found.',
  TEMPLATE_NOT_FOUND: 'Choose a class from your studio.',
  SESSION_ALREADY_EXISTS: 'This class already has a session at that time. Open it in your schedule to edit its quota.',
  INVALID_QUOTA: 'The quota must cover seats already booked and stay within capacity.',
  INVALID_CAPACITY: 'Enter a whole-number capacity between 1 and 500.',
  INVALID_START_TIME: 'Choose a valid future date and time for your studio.',
  INVALID_SESSION_STATUS: 'Quota can only be changed for an upcoming session.',
  CHECK_IN_TOO_EARLY: 'Check-in opens one hour before the session starts.',
  BOOKING_NOT_FOUND: 'This booking could not be found.',
  BOOKING_NOT_CONFIRMED: 'This booking can no longer be checked in.',
  unknown_error: 'We couldn’t save this change. Please try again.',
} as const

export const studioSuccess = new Set(['created', 'quota', 'attended'])
