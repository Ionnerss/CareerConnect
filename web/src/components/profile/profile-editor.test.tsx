// @vitest-environment jsdom

/**
 * Tests the profile page component: viewing profile details,
 * editing and saving them, validation, cancel, and image upload.
 * The server action and the upload API are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileEditor, type ProfileData } from "./profile-editor";

const mocks = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/app/profile/actions", () => ({
  saveProfile: mocks.saveProfile,
}));

const fullProfile: ProfileData = {
  full_name: "Ray Ntukanyagwe",
  bio: "Software engineering student.",
  location: "Montreal",
  contact_email: "ray@example.com",
  avatar_path: null,
  background_path: null,
};

const emptyProfile: ProfileData = {
  full_name: "Ray Ntukanyagwe",
  bio: null,
  location: null,
  contact_email: null,
  avatar_path: null,
  background_path: null,
};

describe("ProfileEditor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows the user's profile details", () => {
    render(<ProfileEditor initialProfile={fullProfile} />);

    expect(screen.getByRole("heading", { name: "Ray Ntukanyagwe" })).toBeDefined();
    expect(screen.getByText("Montreal")).toBeDefined();
    expect(screen.getByText("Software engineering student.")).toBeDefined();
    expect(screen.getByText("ray@example.com")).toBeDefined();
    // No avatar yet, so initials are shown.
    expect(screen.getByText("RN")).toBeDefined();
  });

  it("links to the resumes and cover letters page", () => {
    render(<ProfileEditor initialProfile={fullProfile} />);

    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Resumes & cover letters",
    });
    expect(link.getAttribute("href")).toBe("/upload-resume");
  });

  it("hides the resumes link while editing", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    expect(
      screen.queryByRole("link", { name: "Resumes & cover letters" }),
    ).toBeNull();
  });

  it("shows placeholders when optional details are empty", () => {
    render(<ProfileEditor initialProfile={emptyProfile} />);

    expect(screen.getByText("No location added")).toBeDefined();
    expect(screen.getByText("No bio yet.")).toBeDefined();
    expect(screen.getByText("No contact email added")).toBeDefined();
  });

  it("shows the avatar image when the profile has one", () => {
    render(
      <ProfileEditor
        initialProfile={{ ...fullProfile, avatar_path: "user-1/avatar/a.png" }}
      />,
    );

    const img = screen.getByAltText<HTMLImageElement>("Profile photo");
    expect(img.src).toBe(
      "https://example.supabase.co/storage/v1/object/public/profile-images/user-1/avatar/a.png",
    );
  });

  it("saves edited details and shows the updated profile", async () => {
    const user = userEvent.setup();
    mocks.saveProfile.mockResolvedValue({
      success: true,
      profile: {
        id: "user-1",
        full_name: "Ray N",
        bio: "Software engineering student.",
        location: "Toronto",
        contact_email: "ray@example.com",
      },
    });

    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    const name = screen.getByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Ray N");

    const location = screen.getByLabelText("Location");
    await user.clear(location);
    await user.type(location, "Toronto");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Profile saved.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Ray N" })).toBeDefined();
    expect(screen.getByText("Toronto")).toBeDefined();

    expect(mocks.saveProfile).toHaveBeenCalledOnce();
    expect(mocks.saveProfile).toHaveBeenCalledWith({
      full_name: "Ray N",
      bio: "Software engineering student.",
      location: "Toronto",
      contact_email: "ray@example.com",
    });
  });

  it("does not save when the full name is empty", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Full name"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText("Full name is required (max 100 characters)."),
    ).toBeDefined();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("does not save an invalid contact email", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const email = screen.getByLabelText("Contact email");
    await user.clear(email);
    await user.type(email, "not-an-email");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText("Enter a valid email address or leave it empty."),
    ).toBeDefined();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("shows the server error and stays in edit mode when saving fails", async () => {
    const user = userEvent.setup();
    mocks.saveProfile.mockResolvedValue({
      success: false,
      error: "Unable to save your profile. Please try again.",
    });

    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Unable to save your profile. Please try again."),
    ).toBeDefined();
    expect(screen.getByLabelText("Full name")).toBeDefined();
  });

  it("restores the original details when editing is cancelled", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const name = screen.getByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Someone Else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("heading", { name: "Ray Ntukanyagwe" })).toBeDefined();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("uploads a new profile photo and shows it", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        profile: {
          id: "user-1",
          avatar_path: "user-1/avatar/new.png",
          background_path: null,
        },
      }),
    });

    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    const file = new File(["image"], "photo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Profile photo"), file);

    expect(await screen.findByText("Profile photo updated.")).toBeDefined();
    expect(mocks.fetch).toHaveBeenCalledOnce();

    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("/api/profile-images");
    expect(options.method).toBe("POST");
    expect((options.body as FormData).get("kind")).toBe("avatar");

    const img = screen.getByAltText<HTMLImageElement>("Profile photo");
    expect(img.src).toContain("user-1/avatar/new.png");
  });

  it("shows the upload error when the image is rejected", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        code: "INVALID_INPUT",
        error: "Invalid image. Please try a different image.",
      }),
    });

    render(<ProfileEditor initialProfile={fullProfile} />);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    const file = new File(["image"], "photo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Banner image"), file);

    await waitFor(() => {
      expect(
        screen.getByText("Invalid image. Please try a different image."),
      ).toBeDefined();
    });
    expect(screen.queryByAltText("Profile banner")).toBeNull();
  });
});
