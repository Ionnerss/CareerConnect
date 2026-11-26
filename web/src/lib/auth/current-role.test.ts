import { describe, expect, it, vi } from "vitest";
import { getProfileRole } from "./current-role";

/** A Supabase client whose profile lookup resolves with the given result. */
function client(result: { data: unknown; error: unknown }) {
  const eq = vi.fn(() => ({ maybeSingle: vi.fn(async () => result) }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { supabase: { from } as never, from, select, eq };
}

describe("getProfileRole", () => {
  it("reads the role from the signed-in user's own profile", async () => {
    const { supabase, from, select, eq } = client({ data: { role: "recruiter" }, error: null });

    expect(await getProfileRole(supabase, "user-1")).toBe("recruiter");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("returns job seeker for a job seeker profile", async () => {
    const { supabase } = client({ data: { role: "job_seeker" }, error: null });

    expect(await getProfileRole(supabase, "user-1")).toBe("job_seeker");
  });

  it("treats a missing profile as a job seeker", async () => {
    const { supabase } = client({ data: null, error: null });

    expect(await getProfileRole(supabase, "user-1")).toBe("job_seeker");
  });

  it("never grants the recruiter role when the lookup fails", async () => {
    const { supabase } = client({ data: { role: "recruiter" }, error: { message: "boom" } });

    expect(await getProfileRole(supabase, "user-1")).toBe("job_seeker");
  });
});
