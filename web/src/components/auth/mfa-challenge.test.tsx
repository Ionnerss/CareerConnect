// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MfaChallenge from "./mfa-challenge";

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(), challengeAndVerify: vi.fn(), assurance: vi.fn(),
  getUser: vi.fn(), maybeSingle: vi.fn(), signOut: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  auth: { mfa: { listFactors: mocks.listFactors, challengeAndVerify: mocks.challengeAndVerify,
    getAuthenticatorAssuranceLevel: mocks.assurance }, getUser: mocks.getUser, signOut: mocks.signOut },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
}) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listFactors.mockResolvedValue({ data: { totp: [
    { id: "primary", status: "verified", friendly_name: "Primary" },
    { id: "backup", status: "verified", friendly_name: "Backup" },
  ] }, error: null });
  mocks.challengeAndVerify.mockResolvedValue({ error: null });
  mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { role: "job_seeker" }, error: null });
});
afterEach(cleanup);

it("uses the selected backup and rejects an external return destination", async () => {
  const user = userEvent.setup();
  render(<MfaChallenge returnTo="//evil.example" />);
  await user.selectOptions(await screen.findByLabelText("Authenticator"), "backup");
  await user.type(screen.getByLabelText("Authentication code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify and Continue" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
  expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: "backup", code: "123456" });
});

it("allows cancellation by signing out", async () => {
  mocks.signOut.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<MfaChallenge />);
  await user.click(screen.getByRole("button", { name: "Cancel and sign out" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" }));
  expect(mocks.replace).toHaveBeenCalledWith("/auth/login");
});
