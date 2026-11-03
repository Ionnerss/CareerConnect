// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MfaEnrollment from "./mfa-enrollment";

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(),
  challengeAndVerify: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn(), refreshSession: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { mfa: {
    listFactors: mocks.listFactors, enroll: mocks.enroll, unenroll: mocks.unenroll,
    challengeAndVerify: mocks.challengeAndVerify,
    getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
  }, refreshSession: mocks.refreshSession } }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
  mocks.unenroll.mockResolvedValue({ data: {}, error: null });
  mocks.enroll.mockResolvedValue({ data: {
    id: "new-factor", totp: { qr_code: "<svg></svg>", secret: "SENSITIVE-TEST-KEY" },
  }, error: null });
});
afterEach(cleanup);

it("clears only an abandoned unverified factor before restarting setup", async () => {
  const abandoned = { id: "abandoned", factor_type: "totp", status: "unverified" };
  mocks.listFactors.mockResolvedValue({ data: { totp: [], all: [abandoned] }, error: null });
  const user = userEvent.setup();
  render(<MfaEnrollment />);
  await user.click(await screen.findByRole("button", { name: "Enable Two-Factor Authentication" }));
  await screen.findByText("SENSITIVE-TEST-KEY");
  expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "abandoned" });
  expect(mocks.enroll).toHaveBeenCalledOnce();
});

it("requires an existing factor code before offering backup enrollment", async () => {
  const factor = { id: "existing", status: "verified", friendly_name: "First device" };
  mocks.listFactors.mockResolvedValue({ data: { totp: [factor], all: [factor] }, error: null });
  mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  const user = userEvent.setup();
  render(<MfaEnrollment />);
  const add = await screen.findByRole("button", { name: "Add backup authenticator" });
  expect((add as HTMLButtonElement).disabled).toBe(true);
  await user.selectOptions(screen.getByLabelText("Existing authenticator"), "existing");
  await user.type(screen.getByLabelText("Fresh code from selected authenticator"), "123456");
  await user.click(add);
  await waitFor(() => expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: "existing", code: "123456" }));
  expect(mocks.enroll).toHaveBeenCalledOnce();
});
