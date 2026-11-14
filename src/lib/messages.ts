const errors: Record<string, string> = {
  BOOKING_NOT_FOUND: "We couldn't find that booking.",
  BOOKING_NOT_CONFIRMED: "This booking is no longer confirmed.",
  SESSION_NOT_FOUND: "We couldn't find that workshop.",
  SESSION_UNAVAILABLE: "That session is no longer available. Please choose another date.",
  SESSION_ALREADY_STARTED: "This session has already started.",
  INVALID_IDEMPOTENCY_KEY: "Refresh the workshop page and retry your booking.",
  IDEMPOTENCY_KEY_CONFLICT: "Refresh the workshop page before booking a different session.",
  SUBSCRIPTION_ALREADY_ACTIVE: "You already have an active membership.",
  PAYMENT_REF_CONFLICT: "This billing cycle already has a membership payment.",
  BOOKING_ALREADY_CANCELLED: "This reservation has already been cancelled. Choose a date to book again.",
  SOLD_OUT: "That session just filled up. Please choose another date.",
  SUBSCRIPTION_REQUIRED: "Choose a membership before booking.",
  INSUFFICIENT_TOKENS: "You don't have enough tokens for this workshop.",
  ALREADY_BOOKED: "You already have a booking for this session.",
  FORBIDDEN: "This action is unavailable for your account.",
  INVALID_DATA: "Check the information you entered and try again.",
  SIGN_IN_FAILED: "We couldn't sign you in with those details.",
  SIGN_UP_FAILED: "We couldn't create the account. Try another email or sign in.",
  GOOGLE_FAILED: "Google sign-in couldn't be completed. Please try again.",
  auth: "We couldn't confirm the sign-in link. Please sign in again.",
  RENEWAL_REQUIRED: "Confirm that you agree to monthly renewal before continuing.",
  BILLING_UNAVAILABLE: "Checkout is temporarily unavailable. Please try again later.",
  UNEXPECTED: "Something went wrong. Please try again.",
};

export function errorMessage(code: string | string[] | undefined) {
  if (typeof code !== "string") return null;
  return Object.hasOwn(errors, code) ? errors[code] : errors.UNEXPECTED;
}

export function errorCode(error: unknown, fallback = "UNEXPECTED") {
  return error instanceof Error && Object.hasOwn(errors, error.message) ? error.message : fallback;
}
