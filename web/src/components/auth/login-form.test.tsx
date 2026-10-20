// @vitest-environment jsdom

/**
 * Tests the login page with mocked Supabase: each kind of account lands in the
 * right place, and choosing "Recruiter" never lets a non-recruiter in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "./login-form";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
  });
});

afterEach(cleanup);

async function logIn(
  role: "job_seeker" | "recruiter",
  accountRole: string | null,
  email = role === "recruiter" ? "name@live.concordia.ca" : "test@example.com",
) {
  mocks.maybeSingle.mockResolvedValue({ data: accountRole ? { role: accountRole } : null });
  const user = userEvent.setup();
  render(<LoginForm initialRole={role} />);

  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), "Password123");
  await user.click(screen.getByRole("button", { name: /^log in/i }));
}

describe("login by role", () => {
  it("sends a job seeker to the dashboard", async () => {
    await logIn("job_seeker", "job_seeker");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("sends a recruiter who chose Recruiter to their postings", async () => {
    await logIn("recruiter", "recruiter");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recruiter/jobs"));
  });

  it("sends a recruiter to their postings even from the Job seeker tab", async () => {
    await logIn("job_seeker", "recruiter", "name@mail.concordia.ca");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recruiter/jobs"));
  });

  it("refuses and signs out when Recruiter is chosen on a non-recruiter account", async () => {
    await logIn("recruiter", "job_seeker");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/not a recruiter account/i);
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows the sign-in error and stays on the page when the password is wrong", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();
    render(<LoginForm initialRole="job_seeker" />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /^log in/i }));

    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("recruiter log in needs a Concordia email", () => {
  it.each(["name@concordia.ca", "name@live.concordia.ca", "name@mail.concordia.ca"])(
    "lets %s try to log in",
    async (email) => {
      await logIn("recruiter", "recruiter", email);

      await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recruiter/jobs"));
      expect(mocks.signIn).toHaveBeenCalledOnce();
    },
  );

  it.each(["name@gmail.com", "name@concordia.com", "name@evilconcordia.ca"])(
    "stops %s before contacting the server",
    async (email) => {
      await logIn("recruiter", "recruiter", email);

      expect(await screen.findByText(/Concordia email/)).toBeTruthy();
      expect(mocks.signIn).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    },
  );

  it("still lets job seekers use any email", async () => {
    await logIn("job_seeker", "job_seeker", "someone@gmail.com");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("login role switch", () => {
  it("opens on the recruiter tab when asked to", () => {
    render(<LoginForm initialRole="recruiter" />);

    expect(screen.getByRole("heading", { name: "Recruiter log in" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Recruiter" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("switches wording when the tab changes", async () => {
    const user = userEvent.setup();
    render(<LoginForm initialRole="job_seeker" />);

    expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Recruiter" }));

    expect(screen.getByRole("heading", { name: "Recruiter log in" })).toBeTruthy();
  });

  it("shows the Concordia hint only on the recruiter tab", async () => {
    const user = userEvent.setup();
    render(<LoginForm initialRole="job_seeker" />);

    expect(screen.queryByText(/Use your Concordia email/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Recruiter" }));

    expect(screen.getByText(/Use your Concordia email/)).toBeTruthy();
  });
});
