// Where a job seeker's notification takes them when they click it.
// Pure helper (no Supabase imports) so the service, the page and the tests can share it.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeekerNotificationLinkInput = {
  type: string;
  applicationId?: string | null;
  interviewId?: string | null;
};

export type NotificationLink = { href: string; label: string };

/** Only real ids go into a link, so a bad row can't build a strange URL. */
function isId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Element id of an application card on /application-status. */
export function applicationAnchorId(applicationId: string) {
  return `application-${applicationId}`;
}

/** Element id of an interview card on /interviews. */
export function interviewAnchorId(interviewId: string) {
  return `interview-${interviewId}`;
}

/**
 * Interview notifications open that interview on /interviews.
 * Everything else opens the related application on /application-status
 * (the page jumps to the right page of the list and highlights the card).
 */
export function getSeekerNotificationLink({
  type,
  applicationId,
  interviewId,
}: SeekerNotificationLinkInput): NotificationLink {
  if (type.startsWith("interview")) {
    return {
      href: isId(interviewId) ? `/interviews#${interviewAnchorId(interviewId)}` : "/interviews",
      label: "View interview",
    };
  }

  if (isId(applicationId)) {
    return {
      href: `/application-status?application=${applicationId}#${applicationAnchorId(applicationId)}`,
      label: "View application",
    };
  }

  return { href: "/application-status", label: "View applications" };
}
