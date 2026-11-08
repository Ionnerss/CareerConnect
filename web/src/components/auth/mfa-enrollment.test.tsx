// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MfaEnrollment from "./mfa-enrollment";

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      mfa: {
        listFactors: mocks.listFactors,
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
        challengeAndVerify: mocks.challengeAndVerify,
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
      },
      refreshSession: mocks.refreshSession,
    },
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();

  mocks.listFactors.mockResolvedValue({
    data: { totp: [], all: [] },
    error: null,
  });
  mocks.unenroll.mockResolvedValue({ data: {}, error: null });
  mocks.enroll.mockResolvedValue({
    data: {
      id: "new-factor",
      totp: {
        qr_code: "<svg></svg>",
        secret: "SENSITIVE-TEST-KEY",
      },
    },
    error: null,
  });
});

afterEach(cleanup);

it("clears only an abandoned unverified factor before restarting setup", async () => {
  const abandoned = {
    id: "abandoned",
    factor_type: "totp",
    status: "unverified",
  };
  mocks.listFactors.mockResolvedValue({
    data: { totp: [], all: [abandoned] },
    error: null,
  });

  const user = userEvent.setup();
  render(<MfaEnrollment />);

  await user.click(
    await screen.findByRole("button", {
      name: "Enable Two-Factor Authentication",
    })
  );
  await screen.findByText("SENSITIVE-TEST-KEY");

  expect(mocks.unenroll).toHaveBeenCalledWith({
    factorId: "abandoned",
  });
  expect(mocks.enroll).toHaveBeenCalledOnce();
});

it("uses a distinct name when enrolling a backup authenticator", async () => {
  const factor = {
    id: "existing",
    status: "verified",
    friendly_name: "CareerConnect Authenticator",
  };

  mocks.listFactors.mockResolvedValue({
    data: { totp: [factor], all: [factor] },
    error: null,
  });
  mocks.challengeAndVerify.mockResolvedValue({
    data: {},
    error: null,
  });

  const user = userEvent.setup();
  render(<MfaEnrollment />);

  const add = await screen.findByRole("button", {
    name: "Add backup authenticator",
  });

  expect((add as HTMLButtonElement).disabled).toBe(true);

  await user.selectOptions(
    screen.getByLabelText("Existing authenticator"),
    "existing"
  );
  await user.type(
    screen.getByLabelText("Fresh code from selected authenticator"),
    "123456"
  );
  await user.click(add);

  await screen.findByText("SENSITIVE-TEST-KEY");

  expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
    factorId: "existing",
    code: "123456",
  });
  expect(mocks.enroll).toHaveBeenCalledOnce();

  const [enrollParams] = mocks.enroll.mock.calls[0];

  expect(enrollParams.factorType).toBe("totp");
  expect(typeof enrollParams.friendlyName).toBe("string");
  expect(enrollParams.friendlyName.length).toBeGreaterThan(0);
  expect(enrollParams.friendlyName).not.toBe(factor.friendly_name);
});

it("refreshes the session before showing new MFA enrollment as complete", async () => {
  const user = userEvent.setup();
  const newFactor = {
    id: "new-factor",
    factor_type: "totp",
    status: "verified",
  };

  mocks.challengeAndVerify.mockResolvedValue({
    data: {},
    error: null,
  });

  let releaseRefresh: (() => void) | undefined;
  mocks.refreshSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        releaseRefresh = () =>
          resolve({ data: { session: {} }, error: null });
      })
  );

  render(<MfaEnrollment />);

  await user.click(
    await screen.findByRole("button", {
      name: "Enable Two-Factor Authentication",
    })
  );
  await screen.findByText("SENSITIVE-TEST-KEY");

  // Initial status and pre-enrollment lookups have finished.
  // The next lookup happens after the new code is verified.
  mocks.listFactors.mockResolvedValueOnce({
    data: { totp: [newFactor], all: [newFactor] },
    error: null,
  });

  await user.type(
    screen.getByLabelText("Verification code"),
    "123456"
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and Enable 2FA" })
  );

  await waitFor(() => {
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
  });

  expect(
    screen.queryByText(/Two-factor authentication is enabled with/)
  ).toBeNull();

  releaseRefresh?.();

  expect(
    await screen.findByText(
      "Two-factor authentication is enabled with 1 authenticator(s)."
    )
  ).toBeTruthy();
});

it("keeps setup visible when verification succeeds but session refresh fails", async () => {
  const user = userEvent.setup();

  mocks.challengeAndVerify.mockResolvedValue({
    data: {},
    error: null,
  });
  mocks.refreshSession.mockResolvedValue({
    data: { session: null },
    error: new Error("Refresh failed"),
  });

  render(<MfaEnrollment />);

  await user.click(
    await screen.findByRole("button", {
      name: "Enable Two-Factor Authentication",
    })
  );
  await screen.findByText("SENSITIVE-TEST-KEY");

  await user.type(
    screen.getByLabelText("Verification code"),
    "123456"
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and Enable 2FA" })
  );

  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Your authenticator was verified, but your session could not be refreshed. Please sign out and sign in again."
  );
  expect(mocks.refreshSession).toHaveBeenCalledOnce();
  expect(screen.getByText("SENSITIVE-TEST-KEY")).toBeTruthy();
  expect(
    screen.queryByText(/Two-factor authentication is enabled with/)
  ).toBeNull();
});

it("keeps the existing factor when backup verification fails", async () => {
  const user = userEvent.setup();
  const existingFactor = {
    id: "existing",
    factor_type: "totp",
    status: "verified",
    friendly_name: "First device",
  };

  mocks.listFactors.mockResolvedValue({
    data: {
      totp: [existingFactor],
      all: [existingFactor],
    },
    error: null,
  });

  // The existing factor's fresh code succeeds; the new factor's code fails.
  mocks.challengeAndVerify
    .mockResolvedValueOnce({ data: {}, error: null })
    .mockResolvedValueOnce({
      data: null,
      error: new Error("Invalid backup code"),
    });

  render(<MfaEnrollment />);

  await user.selectOptions(
    await screen.findByLabelText("Existing authenticator"),
    "existing"
  );
  await user.type(
    screen.getByLabelText("Fresh code from selected authenticator"),
    "123456"
  );
  await user.click(
    screen.getByRole("button", { name: "Add backup authenticator" })
  );

  await screen.findByText("SENSITIVE-TEST-KEY");

  await user.type(
    screen.getByLabelText("Verification code"),
    "654321"
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and Enable 2FA" })
  );

  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Unable to verify the code. Please try again."
  );
  expect(screen.getByText("SENSITIVE-TEST-KEY")).toBeTruthy();
  expect(mocks.challengeAndVerify).toHaveBeenNthCalledWith(2, {
    factorId: "new-factor",
    code: "654321",
  });
  expect(mocks.unenroll).not.toHaveBeenCalledWith({
    factorId: "existing",
  });
});

it("verifies a backup before allowing removal of the old factor", async () => {
  const user = userEvent.setup();

  const existingFactor = {
    id: "existing",
    factor_type: "totp",
    status: "verified",
    friendly_name: "First device",
  };
  const newFactor = {
    id: "new-factor",
    factor_type: "totp",
    status: "verified",
    friendly_name: "Backup device",
  };

  let factors = [existingFactor];

  mocks.listFactors.mockImplementation(async () => ({
    data: {
      totp: [...factors],
      all: [...factors],
    },
    error: null,
  }));

  mocks.challengeAndVerify.mockImplementation(
    async ({ factorId }: { factorId: string }) => {
      if (factorId === "new-factor") {
        // The backup becomes verified only after its code succeeds.
        factors = [...factors, newFactor];
      }
      return { data: {}, error: null };
    }
  );

  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2" },
    error: null,
  });
  mocks.refreshSession.mockResolvedValue({
    data: { session: {} },
    error: null,
  });

  mocks.unenroll.mockImplementation(
    async ({ factorId }: { factorId: string }) => {
      factors = factors.filter((factor) => factor.id !== factorId);
      return { data: {}, error: null };
    }
  );

  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

  try {
    render(<MfaEnrollment />);

    // Verify the old factor before starting backup enrollment.
    await user.selectOptions(
      await screen.findByLabelText("Existing authenticator"),
      "existing"
    );
    await user.type(
      screen.getByLabelText("Fresh code from selected authenticator"),
      "123456"
    );
    await user.click(
      screen.getByRole("button", {
        name: "Add backup authenticator",
      })
    );

    await screen.findByText("SENSITIVE-TEST-KEY");

    // Verify the newly enrolled backup.
    await user.type(
      screen.getByLabelText("Verification code"),
      "654321"
    );
    await user.click(
      screen.getByRole("button", {
        name: "Verify and Enable 2FA",
      })
    );

    expect(
      await screen.findByText(
        "Two-factor authentication is enabled with 2 authenticator(s)."
      )
    ).toBeTruthy();

    // The old factor must still exist at this point.
    expect(factors.map((factor) => factor.id)).toEqual([
      "existing",
      "new-factor",
    ]);
    expect(mocks.unenroll).not.toHaveBeenCalled();
    expect(mocks.refreshSession).toHaveBeenCalledOnce();

    // Now explicitly remove the old factor.
    await user.selectOptions(
      screen.getByLabelText("Existing authenticator"),
      "existing"
    );
    await user.type(
      screen.getByLabelText("Fresh code from selected authenticator"),
      "789012"
    );
    await user.click(
      screen.getByRole("button", {
        name: "Remove selected authenticator",
      })
    );

    expect(
      await screen.findByText(
        "Two-factor authentication is enabled with 1 authenticator(s)."
      )
    ).toBeTruthy();

    expect(confirm).toHaveBeenCalledWith(
      "Remove this authenticator? Keep your backup available."
    );
    expect(mocks.unenroll).toHaveBeenCalledOnce();
    expect(mocks.unenroll).toHaveBeenCalledWith({
      factorId: "existing",
    });
    expect(mocks.unenroll).not.toHaveBeenCalledWith({
      factorId: "new-factor",
    });
    expect(factors.map((factor) => factor.id)).toEqual(["new-factor"]);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
  } finally {
    confirm.mockRestore();
  }
});

it("keeps backup setup open when the new factor is not confirmed as verified", async () => {
  const user = userEvent.setup();

  const existingFactor = {
    id: "existing",
    factor_type: "totp",
    status: "verified",
    friendly_name: "First device",
  };

  const newUnverifiedFactor = {
    id: "new-factor",
    factor_type: "totp",
    status: "unverified",
    friendly_name: "Backup device",
  };

  mocks.listFactors.mockResolvedValue({
    data: {
      totp: [existingFactor],
      all: [existingFactor],
    },
    error: null,
  });

  mocks.challengeAndVerify.mockResolvedValue({
    data: {},
    error: null,
  });

  mocks.refreshSession.mockResolvedValue({
    data: { session: {} },
    error: null,
  });

  render(<MfaEnrollment />);

  await user.selectOptions(
    await screen.findByLabelText("Existing authenticator"),
    "existing"
  );

  await user.type(
    screen.getByLabelText("Fresh code from selected authenticator"),
    "123456"
  );

  await user.click(
    screen.getByRole("button", {
      name: "Add backup authenticator",
    })
  );

  await screen.findByText("SENSITIVE-TEST-KEY");

  // The existing factor remains verified, but the newly enrolled
  // factor has not appeared as verified after challengeAndVerify().
  mocks.listFactors.mockResolvedValueOnce({
    data: {
      totp: [existingFactor, newUnverifiedFactor],
      all: [existingFactor, newUnverifiedFactor],
    },
    error: null,
  });

  await user.type(
    screen.getByLabelText("Verification code"),
    "654321"
  );

  await user.click(
    screen.getByRole("button", {
      name: "Verify and Enable 2FA",
    })
  );

  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Your authenticator was verified, but its status could not be confirmed. Please refresh this page."
  );

  expect(mocks.refreshSession).toHaveBeenCalledOnce();
  expect(screen.getByText("SENSITIVE-TEST-KEY")).toBeTruthy();

  expect(
    screen.queryByText(
      "Two-factor authentication is enabled with 1 authenticator(s)."
    )
  ).toBeNull();
});

it("reports when factor removal succeeds but refresh returns no session", async () => {
  const user = userEvent.setup();

  const factor = {
    id: "existing",
    factor_type: "totp",
    status: "verified",
    friendly_name: "First device",
  };

  mocks.listFactors.mockResolvedValue({
    data: { totp: [factor], all: [factor] },
    error: null,
  });

  mocks.challengeAndVerify.mockResolvedValue({
    data: {},
    error: null,
  });

  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2" },
    error: null,
  });

  mocks.unenroll.mockResolvedValue({
    data: {},
    error: null,
  });

  mocks.refreshSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

  try {
    render(<MfaEnrollment />);

    await user.selectOptions(
      await screen.findByLabelText("Existing authenticator"),
      "existing"
    );

    await user.type(
      screen.getByLabelText("Fresh code from selected authenticator"),
      "123456"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Remove selected authenticator",
      })
    );

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Factor removed. Sign out and in again to refresh your session."
    );

    expect(mocks.unenroll).toHaveBeenCalledOnce();
    expect(mocks.unenroll).toHaveBeenCalledWith({
      factorId: "existing",
    });
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
  } finally {
    confirm.mockRestore();
  }
});