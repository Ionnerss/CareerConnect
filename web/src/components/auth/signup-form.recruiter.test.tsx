// @vitest-environment jsdom

/**
 * Recruiter sign-up: Concordia emails only. The website blocks other addresses
 * early; the database makes the final decision (see the migration).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

async function fillAndSubmit(email: string, initialRole: "job_seeker" | "recruiter" = "recruiter") {
  const user = userEvent.setup();
  render(<SignupForm initialRole={initialRole} />);

  await user.type(screen.getByLabelText("Full name"), "Test Person");
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), "Password123");
  await user.type(screen.getByLabelText("Confirm password"), "Password123");
  await user.click(screen.getByRole("button", { name: /^sign up/i }));
}

describe("recruiter sign-up", () => {
  it.each(["name@concordia.ca", "name@live.concordia.ca", "student.20241@mail.concordia.ca"])(
    "accepts %s and asks for a recruiter account",
    async (email) => {
      await fillAndSubmit(email);

      await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/auth/login?as=recruiter"));
      expect(mocks.signUp).toHaveBeenCalledWith({
        email,
        password: "Password123",
        options: { data: { full_name: "Test Person", account_type: "recruiter" } },
      });
    },
  );

  it.each(["name@gmail.com", "name@concordia.com", "name@concordia.ca.evil.com"])(
    "rejects %s without contacting the server",
    async (email) => {
      await fillAndSubmit(email);

      expect(await screen.findByText(/Recruiters need a Concordia email/)).toBeTruthy();
      expect(mocks.signUp).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    },
  );

  it("never sends a recruiter request from the job seeker tab, whatever the email", async () => {
    await fillAndSubmit("name@live.concordia.ca", "job_seeker");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/auth/login"));
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "name@live.concordia.ca",
      password: "Password123",
      options: { data: { full_name: "Test Person" } },
    });
  });

  it("opens on the recruiter tab when asked to", () => {
    render(<SignupForm initialRole="recruiter" />);

    expect(screen.getByRole("heading", { name: "Create a recruiter account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up as recruiter" })).toBeTruthy();
  });
});
