// @vitest-environment jsdom

/**
 * Job seeker sign-up: the validation messages shown for each field, and
 * switching tabs. Submitting and server errors are tested in
 * app/auth/signup/page.test.tsx; recruiter sign-up has its own file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupForm from "./signup-form";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signUp: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockReturnValue({ auth: { signUp: mocks.signUp } });
  mocks.signUp.mockResolvedValue({ error: null });
});

afterEach(cleanup);

type Fields = { name?: string; email?: string; password?: string; confirmPassword?: string };

async function submit(fields: Fields) {
  const user = userEvent.setup();
  render(<SignupForm />);

  if (fields.name) await user.type(screen.getByLabelText("Full name"), fields.name);
  if (fields.email) await user.type(screen.getByLabelText("Email"), fields.email);
  if (fields.password) await user.type(screen.getByLabelText("Password"), fields.password);
  if (fields.confirmPassword) await user.type(screen.getByLabelText("Confirm password"), fields.confirmPassword);
  await user.click(screen.getByRole("button", { name: "Sign up" }));
  return user;
}

const valid = {
  name: "Test Person",
  email: "test@example.com",
  password: "Password123",
  confirmPassword: "Password123",
};

describe("job seeker sign-up", () => {
  it("explains every missing field and does not contact the server", async () => {
    await submit({});

    expect(screen.getByText("Name must be at least 2 characters")).toBeTruthy();
    expect(screen.getByText("Email is required")).toBeTruthy();
    expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
    expect(screen.getByText("Please confirm your password")).toBeTruthy();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    await submit({ ...valid, email: "not-an-email" });

    expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it.each([
    ["password123", "Password must contain at least one uppercase letter"],
    ["Passwordabc", "Password must contain at least one number"],
  ])("rejects the weak password %s", async (password, message) => {
    await submit({ ...valid, password, confirmPassword: password });

    expect(screen.getByText(message)).toBeTruthy();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("rejects passwords that do not match", async () => {
    await submit({ ...valid, confirmPassword: "Password124" });

    expect(screen.getByText("Passwords do not match")).toBeTruthy();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("clears old errors when switching between job seeker and recruiter", async () => {
    const user = await submit({});
    expect(screen.getByText("Email is required")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Recruiter" }));

    expect(screen.queryByText("Email is required")).toBeNull();
    expect(screen.getByRole("heading", { name: "Create a recruiter account" })).toBeTruthy();
  });
});
