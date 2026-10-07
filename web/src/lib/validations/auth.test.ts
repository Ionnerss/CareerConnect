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
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
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

describe("Signup validation: edge cases", () => {
  const validSignup = {
    name: "Test User",
    email: "test@example.com",
    password: "Password123",
    confirmPassword: "Password123",
  };

  it.each(["A", "   ", " B "])(
    "rejects a name shorter than 2 characters after trimming: %j",
    (name) => {
      expect(signupSchema.safeParse({ ...validSignup, name }).success).toBe(false);
    },
  );

  it("accepts a 2-character name", () => {
    expect(signupSchema.safeParse({ ...validSignup, name: "Al" }).success).toBe(true);
  });

  it("shows 'Email is required' when the email is empty", () => {
    const result = signupSchema.safeParse({ ...validSignup, email: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === "Email is required"),
      ).toBe(true);
    }
  });

  it("trims spaces around the email", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      email: "  test@example.com  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("asks the user to confirm their password when it is left empty", () => {
    const result = signupSchema.safeParse({ ...validSignup, confirmPassword: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === "Please confirm your password",
        ),
      ).toBe(true);
    }
  });

  it("accepts a password of exactly 8 characters", () => {
    const password = "Passwor1";
    expect(
      signupSchema.safeParse({ ...validSignup, password, confirmPassword: password })
        .success,
    ).toBe(true);
  });

  it("rejects a password of 7 characters", () => {
    const password = "Passwo1";
    expect(
      signupSchema.safeParse({ ...validSignup, password, confirmPassword: password })
        .success,
    ).toBe(false);
  });

  it("explains that an uppercase letter is missing", () => {
    const password = "password123";
    const result = signupSchema.safeParse({
      ...validSignup,
      password,
      confirmPassword: password,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message === "Password must contain at least one uppercase letter",
        ),
      ).toBe(true);
    }
  });
});

describe("Login validation: edge cases", () => {
  it("shows 'Email is required' when the email is empty", () => {
    const result = loginSchema.safeParse({ email: "", password: "Password123" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === "Email is required"),
      ).toBe(true);
    }
  });

  it("trims spaces around the email", () => {
    const result = loginSchema.safeParse({
      email: "  test@example.com  ",
      password: "Password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });
});