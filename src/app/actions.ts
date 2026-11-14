"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, signIn, signInDemo, signInWithGoogle, signOut, signUp } from "@/lib/auth";
import { createBillingPortal, createCheckout, getBillingMode, simulateCheckout } from "@/lib/billing";
import { getSession } from "@/lib/catalog";
import { query, rpc } from "@/lib/db";
import { sendBookingConfirmation } from "@/lib/mail";
import { errorCode } from "@/lib/messages";

const credentials = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) });
const bookingInput = z.object({ session: z.uuid(), request: z.uuid(), slug: z.string().regex(/^[a-z0-9-]{1,100}$/) });
const plans = z.enum(["starter", "studio", "collective"]);

async function siteOrigin() {
  if (process.env.APP_URL) return new URL(process.env.APP_URL).origin;
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (host && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) return `http://${host}`;
  throw new Error("APP_URL is required on a hosted deployment.");
}

function nextDestination(value: FormDataEntryValue | null) {
  return value === "/membership" || value === "/discover" ? value : "/account";
}

export async function loginAction(form: FormData) {
  const input = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  const next = nextDestination(form.get("next"));
  if (!input.success) redirect(`/login?error=INVALID_DATA&next=${encodeURIComponent(next)}`);
  try { await signIn(input.data.email, input.data.password); }
  catch { redirect(`/login?error=SIGN_IN_FAILED&next=${encodeURIComponent(next)}`); }
  redirect(next);
}

export async function signupAction(form: FormData) {
  const input = credentials.extend({ name: z.string().trim().min(2).max(80) }).safeParse({ email: form.get("email"), password: form.get("password"), name: form.get("name") });
  const next = nextDestination(form.get("next"));
  if (!input.success) redirect(`/login?mode=signup&error=INVALID_DATA&next=${encodeURIComponent(next)}`);
  let status: string;
  try { status = await signUp(input.data.email, input.data.password, input.data.name, await siteOrigin()); }
  catch { redirect(`/login?mode=signup&error=SIGN_UP_FAILED&next=${encodeURIComponent(next)}`); }
  redirect(status === "confirm-email" ? "/login?status=check-email" : next);
}

export async function googleAction() {
  let destination: string;
  try { destination = await signInWithGoogle(await siteOrigin()); }
  catch { redirect("/login?error=GOOGLE_FAILED"); }
  redirect(destination);
}

export async function demoAction(form: FormData) {
  const role = z.enum(["member", "studio", "admin"]).safeParse(form.get("role"));
  if (!role.success) redirect("/login?error=INVALID_DATA");
  try { await signInDemo(role.data); }
  catch { redirect("/login?error=SIGN_IN_FAILED"); }
  redirect(role.data === "member" ? "/discover" : `/${role.data}`);
}

export async function logoutAction() {
  await signOut();
  redirect("/");
}

export async function checkoutAction(form: FormData) {
  const user = await requireUser("member");
  const plan = plans.safeParse(form.get("plan"));
  if (!plan.success) redirect("/membership?error=INVALID_DATA");
  if (form.get("consent") !== "on") redirect("/membership?error=RENEWAL_REQUIRED");
  let target: string;
  try {
    if (getBillingMode() === "demo") {
      await simulateCheckout(user, plan.data, true);
      target = "/account?checkout=demo";
    } else {
      target = await createCheckout(user, plan.data, await siteOrigin(), true);
    }
  } catch (error) {
    redirect(`/membership?error=${encodeURIComponent(errorCode(error, "BILLING_UNAVAILABLE"))}`);
  }
  revalidatePath("/account");
  redirect(target);
}

export async function billingPortalAction() {
  const user = await requireUser("member");
  let target: string;
  try { target = await createBillingPortal(user, await siteOrigin()); }
  catch { redirect("/account?error=BILLING_UNAVAILABLE"); }
  redirect(target);
}

export async function bookAction(form: FormData) {
  const user = await requireUser("member");
  const input = bookingInput.safeParse({ session: form.get("session"), request: form.get("request"), slug: form.get("slug") });
  if (!input.success) redirect("/discover?error=INVALID_DATA");
  const { session, request, slug } = input.data;
  const detail = `/discover/${slug}?session=${session}`;
  let booking: { booking_id: string; created: boolean };
  try { booking = await rpc("book_session", { p_member_id: user.id, p_session_id: session, p_idempotency_key: request }); }
  catch (error) { redirect(`${detail}&error=${errorCode(error)}`); }
  if (!booking.created) {
    const [existing] = await query<{ status: string }>("SELECT status FROM public.bookings WHERE id = $1 AND member_id = $2", [booking.booking_id, user.id]);
    if (existing?.status.startsWith("cancelled")) redirect(`${detail}&error=BOOKING_ALREADY_CANCELLED`);
  }
  if (booking.created) {
    try {
      const slot = await getSession(session);
      if (slot) await sendBookingConfirmation({
        to: user.email, name: user.name, className: slot.title, studioName: slot.studio_name,
        startsAt: new Date(slot.starts_at).toISOString(), timezone: slot.timezone, bookingId: booking.booking_id,
      });
    } catch (error) {
      console.error("Booking confirmation email failed", { bookingId: booking.booking_id, error: error instanceof Error ? error.name : "unknown" });
    }
  }
  revalidatePath("/discover");
  revalidatePath("/account");
  redirect("/account?booking=confirmed");
}

export async function cancelAction(form: FormData) {
  const user = await requireUser("member");
  const id = z.uuid().safeParse(form.get("booking"));
  if (!id.success) redirect("/account?error=INVALID_DATA");
  let result: { status: string };
  try { result = await rpc("cancel_booking", { p_member_id: user.id, p_booking_id: id.data }); }
  catch (error) { redirect(`/account?error=${errorCode(error)}`); }
  revalidatePath("/discover");
  revalidatePath("/account");
  redirect(`/account?booking=${result.status === "cancelled_free" ? "cancelled-free" : "cancelled-late"}`);
}
