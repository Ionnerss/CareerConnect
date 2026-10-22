/**
 * Who someone is signing in as, and where each kind of account lands.
 * `profiles.role` in the database is the source of truth. The login page's
 * "Job seeker / Recruiter" switch only chooses which wording to show and is
 * checked against that value.
 */

export type LoginRole = "job_seeker" | "recruiter";

/** Where each kind of account lands after login. Add a role here to give it a front door. */
export const ROLE_HOME_PATH: Record<LoginRole, string> = {
  job_seeker: "/dashboard",
  recruiter: "/recruiter/jobs",
};

/** Reads `?as=` from the login URL. Anything unknown means job seeker. */
export function parseLoginRole(
  value: string | string[] | undefined | null,
): LoginRole {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "recruiter" ? "recruiter" : "job_seeker";
}

/** Maps a `profiles.role` value to a role we know. Unknown or missing means job seeker. */
export function normalizeRole(role: string | null | undefined): LoginRole {
  return role === "recruiter" ? "recruiter" : "job_seeker";
}

export function getHomePathForRole(role: string | null | undefined): string {
  return ROLE_HOME_PATH[normalizeRole(role)];
}

/** Which kind of account a page is for. */
export type Audience = LoginRole;

/**
 * Where to send someone who opened a page meant for the other kind of account,
 * or null if they belong there. Recruiters never see job seeker pages (profile,
 * resume, applications) and job seekers never see recruiter pages.
 */
export function getAudienceRedirect(
  role: LoginRole,
  audience: Audience,
): string | null {
  return role === audience ? null : ROLE_HOME_PATH[role];
}
