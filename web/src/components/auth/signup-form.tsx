"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recruiterSignupSchema, signupSchema } from "@/lib/validations/auth";
import { CONCORDIA_EMAIL_HINT } from "@/lib/auth/concordia";
import type { LoginRole } from "@/lib/auth/roles";
import AuthShell from "@/components/auth/auth-shell";
import RoleSwitch from "@/components/auth/role-switch";
import styles from "@/components/auth/auth.module.css";

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string>
>;

const ROLE_COPY: Record<LoginRole, { title: string; subtitle: string; submit: string }> = {
  job_seeker: {
    title: "Create your account",
    subtitle: "Start tracking your job search with CareerConnect.",
    submit: "Sign up",
  },
  recruiter: {
    title: "Create a recruiter account",
    subtitle: "For recruiters with a Concordia email. See who applied to your postings.",
    submit: "Sign up as recruiter",
  },
};

export default function SignupForm({ initialRole = "job_seeker" }: { initialRole?: LoginRole }) {
  const router = useRouter();
  const [role, setRole] = useState<LoginRole>(initialRole);
  const copy = ROLE_COPY[role];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);

    const schema = role === "recruiter" ? recruiterSignupSchema : signupSchema;
    const result = schema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          // Job seeker data stays exactly as before. The database decides whether
          // a recruiter request is allowed (Concordia email, confirmed).
          data:
            role === "recruiter"
              ? { full_name: result.data.name, account_type: "recruiter" }
              : { full_name: result.data.name },
        },
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      router.push(role === "recruiter" ? "/auth/login?as=recruiter" : "/auth/login");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>

      <RoleSwitch
        label="Sign up as"
        value={role}
        onChange={(next) => {
          setRole(next);
          setErrors({});
          setFormError(null);
        }}
      />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>
            Full name
          </label>
          <input
            className={styles.input}
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className={styles.fieldError}>{errors.name}</p>}
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email ? (
            <p className={styles.fieldError}>{errors.email}</p>
          ) : (
            role === "recruiter" && <p className={styles.hint}>{CONCORDIA_EMAIL_HINT}</p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            className={styles.input}
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && (
            <p className={styles.fieldError}>{errors.password}</p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Confirm password
          </label>
          <input
            className={styles.input}
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {errors.confirmPassword && (
            <p className={styles.fieldError}>{errors.confirmPassword}</p>
          )}
        </div>

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : copy.submit}
        </button>
      </form>

      <p className={styles.switch}>
        Already have an account?{" "}
        <Link href={role === "recruiter" ? "/auth/login?as=recruiter" : "/auth/login"}>Log in</Link>
      </p>

      {role === "recruiter" && (
        <p className={styles.note}>
          Recruiter accounts are only for Concordia email addresses. You will need to confirm your
          email before you can log in as a recruiter.
        </p>
      )}
    </AuthShell>
  );
}
