"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createJob } from "@/app/recruiter/jobs/actions";
import {
  JOB_STATUS_OPTIONS,
  JOB_WORK_MODES,
  JOB_EMPLOYMENT_TYPES,
  MAX_JOB_DESCRIPTION_LENGTH,
  jobPostingSchema,
  parseSkillList,
} from "@/lib/validations/job-posting";
import { ui } from "@/components/profile/profile-ui";

type FormValues = {
  title: string;
  firm_name: string;
  location: string;
  work_mode: string;
  required_skills: string;
  salary: string;
  experience: string;
  description: string;
  status: string;
  employment_type: string;
};

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormValues = {
  title: "",
  firm_name: "",
  location: "",
  work_mode: "",
  required_skills: "",
  salary: "",
  experience: "",
  description: "",
  status: "open",
  employment_type: "",
};

/** Where the recruiter lands after posting, and where Cancel goes. */
export const RECRUITER_JOBS_PATH = "/recruiter/jobs";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: FieldName;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`job-${id}`} className={ui.label}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`job-${id}-hint`} className="text-xs text-[#6B7280]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`job-${id}-error`} className={ui.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

export function JobPostingForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const skills = parseSkillList(values.required_skills);

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /** Props shared by every input: id, value, change handler and error wiring. */
  function fieldProps(field: FieldName) {
    return {
      id: `job-${field}`,
      value: values[field],
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `job-${field}-error` : undefined,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const result = jobPostingSchema.safeParse(values);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as FieldName;
        if (key in EMPTY_FORM && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const response = await createJob(values);

      if (!response.success) {
        setFormError(response.error);
        return;
      }

      router.push(RECRUITER_JOBS_PATH);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Post a job" className="space-y-5">
      {formError && (
        <p role="alert" className={ui.error}>
          {formError}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="title" label="Job title" error={errors.title}>
          <input
            {...fieldProps("title")}
            className={ui.input}
            placeholder="e.g. Junior Frontend Developer"
            onChange={(e) => updateField("title", e.target.value)}
          />
        </Field>

        <Field id="firm_name" label="Company name" error={errors.firm_name}>
          <input
            {...fieldProps("firm_name")}
            className={ui.input}
            placeholder="e.g. Acme Inc."
            onChange={(e) => updateField("firm_name", e.target.value)}
          />
        </Field>

        <Field id="location" label="Location" error={errors.location}>
          <input
            {...fieldProps("location")}
            className={ui.input}
            placeholder="e.g. Montreal, QC"
            onChange={(e) => updateField("location", e.target.value)}
          />
        </Field>

        <Field id="work_mode" label="Work mode" error={errors.work_mode}>
          <select
            {...fieldProps("work_mode")}
            className={ui.input}
            onChange={(e) => updateField("work_mode", e.target.value)}
          >
            <option value="">Select a work mode</option>
            {JOB_WORK_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="employment_type"
          label="Employment type"
          error={errors.employment_type}
        >
          <select
            {...fieldProps("employment_type")}
            className={ui.input}
            onChange={(e) =>
              updateField("employment_type", e.target.value)
            }
          >
            <option value="">Select employment type</option>

            {JOB_EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="salary"
          label="Salary (CAD / year, optional)"
          hint="Leave empty if you prefer not to say."
          error={errors.salary}
        >
          <input
            {...fieldProps("salary")}
            className={ui.input}
            inputMode="decimal"
            placeholder="e.g. 65000"
            onChange={(e) => updateField("salary", e.target.value)}
          />
        </Field>

        <Field
          id="experience"
          label="Years of experience (optional)"
          hint="Leave empty if there is no minimum."
          error={errors.experience}
        >
          <input
            {...fieldProps("experience")}
            className={ui.input}
            inputMode="numeric"
            placeholder="e.g. 2"
            onChange={(e) => updateField("experience", e.target.value)}
          />
        </Field>
      </div>

      <Field
        id="required_skills"
        label="Required skills"
        hint="Separate skills with commas. Applicants are ranked by how many they have."
        error={errors.required_skills}
      >
        <input
          {...fieldProps("required_skills")}
          className={ui.input}
          placeholder="e.g. React, TypeScript, SQL"
          onChange={(e) => updateField("required_skills", e.target.value)}
        />
      </Field>

      {skills.length > 0 && (
        <ul aria-label="Skills preview" className="-mt-2 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              key={skill.toLowerCase()}
              className="rounded-full bg-[#E8EEFD] px-3 py-1 text-xs font-semibold text-[#1D4ED8]"
            >
              {skill}
            </li>
          ))}
        </ul>
      )}

      <Field id="description" label="Description" error={errors.description}>
        <textarea
          {...fieldProps("description")}
          className={ui.textarea}
          rows={8}
          maxLength={MAX_JOB_DESCRIPTION_LENGTH}
          placeholder="What will the person do? What does the team look like?"
          onChange={(e) => updateField("description", e.target.value)}
        />
      </Field>

      <div className="sm:max-w-xs">
        <Field
          id="status"
          label="Status"
          hint="Published postings are open. Choose Closed if the position is filled."
          error={errors.status}
        >
          <select
            {...fieldProps("status")}
            className={ui.input}
            onChange={(e) => updateField("status", e.target.value)}
          >
            {JOB_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={ui.primaryButton} disabled={isSaving}>
          {isSaving ? "Posting..." : "Post job"}
        </button>
        <Link href={RECRUITER_JOBS_PATH} className={ui.secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
