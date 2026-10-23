/**
 * Recruiter accounts are limited to Concordia email addresses.
 *
 * Accepted: `concordia.ca` and every subdomain of it, for example
 *   name@concordia.ca, name@live.concordia.ca, name@mail.concordia.ca,
 *   name@encs.concordia.ca, name@users.encs.concordia.ca
 * Rejected: look-alikes such as name@concordia.com, name@evilconcordia.ca,
 *   name@concordia.ca.evil.com, and anything with more than one "@".
 *
 * This is the same rule as `public.is_concordia_email()` in the database
 * (supabase/migrations/20261019140000_recruiter_concordia_signup.sql). The
 * database copy is the one that actually grants the role; this copy only gives
 * people an early, friendly message. Change both together, and add the new
 * case to `concordia.test.ts`.
 */
const CONCORDIA_EMAIL = /^[^@\s]+@([a-z0-9-]+\.)*concordia\.ca$/;

export function isConcordiaEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  return CONCORDIA_EMAIL.test(email.trim().toLowerCase());
}

/** Shown when a recruiter form gets a non-Concordia address. */
export const CONCORDIA_EMAIL_MESSAGE =
  "Recruiters need a Concordia email, like name@concordia.ca or name@live.concordia.ca.";

/** Short hint shown under the email field on the recruiter tab. */
export const CONCORDIA_EMAIL_HINT =
  "Use your Concordia email (name@concordia.ca, name@live.concordia.ca, name@mail.concordia.ca, ...).";
