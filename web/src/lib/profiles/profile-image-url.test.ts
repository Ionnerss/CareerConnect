import { describe, expect, it } from "vitest";
import { getInitials, getProfileImageUrl } from "./profile-image-url";

const BASE = "https://example.supabase.co";

describe("getProfileImageUrl", () => {
  it("builds the public storage URL for a stored path", () => {
    expect(getProfileImageUrl("user-1/avatar/abc.png", BASE)).toBe(
      "https://example.supabase.co/storage/v1/object/public/profile-images/user-1/avatar/abc.png",
    );
  });

  it("removes a trailing slash from the base URL", () => {
    expect(getProfileImageUrl("user-1/avatar/abc.png", `${BASE}/`)).toBe(
      "https://example.supabase.co/storage/v1/object/public/profile-images/user-1/avatar/abc.png",
    );
  });

  it.each([null, undefined, ""])(
    "returns null when there is no image path: %j",
    (path) => {
      expect(getProfileImageUrl(path, BASE)).toBeNull();
    },
  );

  it("returns null when the Supabase URL is missing", () => {
    expect(getProfileImageUrl("user-1/avatar/abc.png", "")).toBeNull();
  });
});

describe("getInitials", () => {
  it.each([
    ["Ray Ntukanyagwe", "RN"],
    ["ray", "R"],
    ["  Ada   Grace Lovelace ", "AL"],
  ])("returns initials for %j", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  it.each([null, undefined, "", "   "])(
    "returns a placeholder for an empty name: %j",
    (name) => {
      expect(getInitials(name)).toBe("?");
    },
  );
});
