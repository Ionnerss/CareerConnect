/**
 * Builds the public URL for an image stored in the "profile-images" bucket.
 * The bucket is public, so no signed URL is needed.
 * Returns null when the profile has no image yet.
 */
export function getProfileImageUrl(
  path: string | null | undefined,
  baseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!path || !baseUrl) {
    return null;
  }

  const base = baseUrl.replace(/\/+$/, "");

  return `${base}/storage/v1/object/public/profile-images/${encodeURI(path)}`;
}

/**
 * Returns up to two initials from a full name, used when there is no avatar.
 */
export function getInitials(fullName: string | null | undefined): string {
  if (!fullName) {
    return "?";
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";

  return `${first}${last}`.toUpperCase();
}
