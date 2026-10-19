"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, recruiterLoginSchema } from "@/lib/validations/auth";
import { getHomePathForRole, normalizeRole, type LoginRole } from "@/lib/auth/roles";
import { CONCORDIA_EMAIL_HINT } from "@/lib/auth/concordia";
import AuthShell from "@/components/auth/auth-shell";
import RoleSwitch from "@/components/auth/role-switch";
import styles from "@/components/auth/auth.module.css";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const ROLE_COPY: Record<LoginRole, { title: string; subtitle: string; submit: string }> = {
  job_seeker: {
    title: "Log in",
    subtitle: "Welcome back to CareerConnect.",
    submit: "Log in",
  },
  recruiter: {
    title: "Recruiter log in",
    subtitle: "See who applied to your postings, best skill match first.",
    submit: "Log in as recruiter",
  },
};

export default function LoginForm({ initialRole = "job_seeker" }: { initialRole?: LoginRole }) {
  const router = useRouter();
  const [role, setRole] = useState<LoginRole>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = ROLE_COPY[role];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const schema = role === "recruiter" ? recruiterLoginSchema : loginSchema;
    const result = schema.safeParse({ email, password });
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      // The database decides who is a recruiter, not the switch above.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      const actualRole = normalizeRole(profile?.role);

      if (role === "recruiter" && actualRole !== "recruiter") {
        await supabase.auth.signOut();
        setFormError(
          "This account is not a recruiter account. Sign up on the Recruiter tab with your Concordia email and confirm it, or choose Job seeker to log in.",
        );
        return;
      }

      router.push(getHomePathForRole(actualRole));
    } catch {
      setFormError("An unexpected error has occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>

      <RoleSwitch
        label="Log in as"
        value={role}
        onChange={(next) => {
          setRole(next);
          setErrors({});
          setFormError(null);
        }}
      />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            type="email"
            value={email}
            aria-invalid={errors.email ? true : undefined}
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
            aria-invalid={errors.password ? true : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <p className={styles.fieldError}>{errors.password}</p>}
        </div>

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : copy.submit}
        </button>
      </form>

      <p className={styles.switch}>
        Don&apos;t have an account?{" "}
        <Link href={role === "recruiter" ? "/auth/signup?as=recruiter" : "/auth/signup"}>
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
