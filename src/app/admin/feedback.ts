export const adminFeedback = {
  refunded: 'Token refund recorded in the audit log.',
  FORBIDDEN: 'This account cannot issue token refunds.',
  BOOKING_NOT_FOUND: 'This booking could not be found.',
  REFUND_REASON_REQUIRED: 'Enter a reason between 5 and 500 characters.',
  REFUND_NOT_AVAILABLE: 'There are no refundable tokens on this booking.',
  unknown_error: 'We couldn’t issue this refund. Please try again.',
} as const
