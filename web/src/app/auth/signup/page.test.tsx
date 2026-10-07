// @vitest-environment jsdom

/**
 * Tests the actual signup form with mocked Supabase responses.
 * Checks successful navigation and ensures failures show an error,
 * re-enable submission, and do not redirect to login.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "./page";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signUp: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

async function submitValidSignup() {
  const user = userEvent.setup();

  render(<SignupPage />);

  await user.type(screen.getByLabelText("Full name"), "Test User");
  await user.type(screen.getByLabelText("Email"), "test@example.com");
  await user.type(screen.getByLabelText("Password"), "Password123");
  await user.type(
    screen.getByLabelText("Confirm password"),
    "Password123",
  );

  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "Sign up",
  });

  await user.click(button);

  return button;
}

describe("signup submission", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.createClient.mockReturnValue({
      auth: { signUp: mocks.signUp },
    });

    mocks.signUp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits signup details and navigates to login on success", async () => {
    await submitValidSignup();

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/auth/login");
    });

    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.signUp).toHaveBeenCalledOnce();

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "Password123",
      options: {
        data: { full_name: "Test User" },
      },
    });
  });

  it("shows a returned error and re-enables the button without redirecting", async () => {
    mocks.signUp.mockResolvedValue({
      error: { message: "Signup service unavailable" },
    });

    const button = await submitValidSignup();

    expect(
      await screen.findByText("Signup service unavailable"),
    ).toBeDefined();

    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });

    expect(mocks.signUp).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("handles a thrown signup error without redirecting", async () => {
    mocks.signUp.mockRejectedValue(new Error("Network failure"));

    const button = await submitValidSignup();

    expect(
      await screen.findByText(
        "An unexpected error occurred. Please try again.",
      ),
    ).toBeDefined();

    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });

    expect(mocks.signUp).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("handles client creation failure and re-enables the button", async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error("Client initialization failed");
    });

    const button = await submitValidSignup();

    expect(
      await screen.findByText(
        "An unexpected error occurred. Please try again.",
      ),
    ).toBeDefined();

    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });

    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});