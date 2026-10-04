import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./auth";

describe("Signup validation", () => {
  const validSignup = {
    name: "Test User",
    email: "test@example.com",
    password: "Password123",
    confirmPassword: "Password123",
  };

  it("accepts valid signup details", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: "Different123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === "confirmPassword",
        ),
      ).toBe(true);
    }
  });

  it.each(["Short1", "password123", "Passwordonly"])(
    "rejects a password that breaks the rules: %s",
    (password) => {
      const result = signupSchema.safeParse({
        ...validSignup,
        password,
        confirmPassword: password,
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });
});

describe("Login validation", () => {
  it("accepts a nonempty password without applying signup rules", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "legacy-password",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "Password123",
    });

    expect(result.success).toBe(false);
  });
});