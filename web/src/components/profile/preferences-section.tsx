"use client";

import { useState, type FormEvent } from "react";
import { Languages, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { addLanguage, deleteLanguage, savePreferences } from "@/app/profile/preferences-actions";
import {
  profilePreferenceLanguageSchema,
  profilePreferencesSchema,
} from "@/lib/validations/profile-preferences";
import { SectionHeader, ui } from "@/components/profile/profile-ui";

export const POSITION_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
] as const;

export const WORK_MODE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on_site", label: "On-site" },
  { value: "no_preference", label: "No preference" },
] as const;

export type Preferences = {
  desired_role: string | null;
  desired_position: string | null;
  desired_salary: number | null;
  work_mode: string | null;
};

export type PreferenceLanguage = {
  id: string;
  name: string;
};

type FormValues = {
  desired_role: string;
  desired_position: string;
  desired_salary: string;
  work_mode: string;
};

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_MESSAGES: Record<FieldName, string> = {
  desired_role: "Desired role must be 150 characters or fewer.",
  desired_position: "Please choose a valid position type.",
  desired_salary: "Enter a positive amount with at most two decimals (e.g. 65000).",
  work_mode: "Please choose a valid work mode.",
};

const EMPTY_PREFERENCES: Preferences = {
  desired_role: null,
  desired_position: null,
  desired_salary: null,
  work_mode: null,
};

function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null,
): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatSalary(value: number | null): string | null {
  if (value === null || value === undefined) return null;
  return `$${Math.round(value).toLocaleString("en-CA")} CAD / year`;
}

function toFormValues(prefs: Preferences): FormValues {
  return {
    desired_role: prefs.desired_role ?? "",
    desired_position: prefs.desired_position ?? "",
    desired_salary: prefs.desired_salary !== null ? String(prefs.desired_salary) : "",
    work_mode: prefs.work_mode ?? "",
  };
}

function toPreferences(raw: Record<string, unknown>): Preferences {
  const salary = raw.desired_salary;
  return {
    desired_role: (raw.desired_role as string | null) ?? null,
    desired_position: (raw.desired_position as string | null) ?? null,
    desired_salary:
      salary === null || salary === undefined || salary === "" ? null : Number(salary),
    work_mode: (raw.work_mode as string | null) ?? null,
  };
}

function PreferenceItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">{label}</dt>
      <dd className={value ? "text-sm font-semibold text-[#0E1726]" : "text-sm text-[#9CA3AF]"}>
        {value ?? "Not set"}
      </dd>
    </div>
  );
}

export function PreferencesSection({
  initialPreferences,
  initialLanguages,
  loadError = null,
}: {
  initialPreferences: Preferences | null;
  initialLanguages: PreferenceLanguage[];
  loadError?: string | null;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences ?? EMPTY_PREFERENCES);
  const [languages, setLanguages] = useState<PreferenceLanguage[]>(initialLanguages);
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<FormValues>(toFormValues(prefs));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [languageName, setLanguageName] = useState("");
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [busyLanguage, setBusyLanguage] = useState<string | null>(null);

  const hasAnyPreference = Object.values(prefs).some((value) => value !== null);

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function startEditing() {
    setValues(toFormValues(prefs));
    setErrors({});
    setFormError(null);
    setMessage(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setErrors({});
    setFormError(null);
    setIsEditing(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const result = profilePreferencesSchema.safeParse(values);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as FieldName;
        if (key in FIELD_MESSAGES && !fieldErrors[key]) {
          fieldErrors[key] = FIELD_MESSAGES[key];
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const response = await savePreferences(values);

      if (!response.success || !("preferences" in response) || !response.preferences) {
        setFormError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to save your preferences. Please try again.",
        );
        return;
      }

      setPrefs(toPreferences(response.preferences as Record<string, unknown>));
      setMessage("Preferences saved.");
      setIsEditing(false);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddLanguage(e: FormEvent) {
    e.preventDefault();
    setLanguageError(null);
    setMessage(null);

    const input = { name: languageName };
    const result = profilePreferenceLanguageSchema.safeParse(input);

    if (!result.success) {
      setLanguageError("Enter a language name (max 100 characters).");
      return;
    }

    setBusyLanguage("new");

    try {
      const response = await addLanguage(input);

      if (!response.success || !("language" in response) || !response.language) {
        setLanguageError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to add your language. Please try again.",
        );
        return;
      }

      const raw = response.language as Record<string, unknown>;
      const added = { id: String(raw.id), name: String(raw.name ?? "") };

      setLanguages((current) =>
        [...current, added].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
      );
      setLanguageName("");
      setMessage("Language added.");
    } catch {
      setLanguageError("An unexpected error occurred. Please try again.");
    } finally {
      setBusyLanguage(null);
    }
  }

  async function handleDeleteLanguage(id: string) {
    setLanguageError(null);
    setMessage(null);
    setBusyLanguage(id);

    try {
      const response = await deleteLanguage(id);

      if (!response.success) {
        setLanguageError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to remove your language. Please try again.",
        );
        return;
      }

      setLanguages((current) => current.filter((language) => language.id !== id));
      setMessage("Language removed.");
    } catch {
      setLanguageError("An unexpected error occurred. Please try again.");
    } finally {
      setBusyLanguage(null);
    }
  }

  return (
    <section aria-labelledby="preferences-heading" className={ui.card}>
      <SectionHeader
        id="preferences-heading"
        icon={SlidersHorizontal}
        title="Job preferences"
        action={
          !isEditing && (
            <button
              type="button"
              className={ui.iconButton}
              onClick={startEditing}
              aria-label="Edit preferences"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </button>
          )
        }
      />

      {loadError && (
        <p role="alert" className={ui.error}>
          {loadError}
        </p>
      )}

      {message && (
        <p role="status" className={ui.success}>
          {message}
        </p>
      )}

      {formError && (
        <p role="alert" className={ui.error}>
          {formError}
        </p>
      )}

      {isEditing ? (
        <form className={ui.form} onSubmit={handleSubmit} noValidate aria-label="Edit preferences">
          <div className="space-y-1.5">
            <label htmlFor="pref-role" className={ui.label}>
              Desired role
            </label>
            <input
              id="pref-role"
              className={ui.input}
              placeholder="e.g. Frontend Developer"
              value={values.desired_role}
              onChange={(e) => updateField("desired_role", e.target.value)}
              aria-invalid={Boolean(errors.desired_role)}
            />
            {errors.desired_role && <p className={ui.fieldError}>{errors.desired_role}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pref-position" className={ui.label}>
              Position type
            </label>
            <select
              id="pref-position"
              className={ui.input}
              value={values.desired_position}
              onChange={(e) => updateField("desired_position", e.target.value)}
              aria-invalid={Boolean(errors.desired_position)}
            >
              <option value="">Not set</option>
              {POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.desired_position && (
              <p className={ui.fieldError}>{errors.desired_position}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pref-work-mode" className={ui.label}>
              Work mode
            </label>
            <select
              id="pref-work-mode"
              className={ui.input}
              value={values.work_mode}
              onChange={(e) => updateField("work_mode", e.target.value)}
              aria-invalid={Boolean(errors.work_mode)}
            >
              <option value="">Not set</option>
              {WORK_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.work_mode && <p className={ui.fieldError}>{errors.work_mode}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pref-salary" className={ui.label}>
              Desired salary (CAD / year)
            </label>
            <input
              id="pref-salary"
              inputMode="decimal"
              className={ui.input}
              placeholder="e.g. 65000"
              value={values.desired_salary}
              onChange={(e) => updateField("desired_salary", e.target.value)}
              aria-invalid={Boolean(errors.desired_salary)}
            />
            {errors.desired_salary && <p className={ui.fieldError}>{errors.desired_salary}</p>}
          </div>

          <div className="flex gap-3">
            <button type="submit" className={ui.primaryButton} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save preferences"}
            </button>
            <button
              type="button"
              className={ui.secondaryButton}
              onClick={cancelEditing}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : hasAnyPreference ? (
        <dl className="mt-5 grid grid-cols-1 gap-4">
          <PreferenceItem label="Desired role" value={prefs.desired_role} />
          <PreferenceItem
            label="Position type"
            value={labelFor(POSITION_OPTIONS, prefs.desired_position)}
          />
          <PreferenceItem label="Work mode" value={labelFor(WORK_MODE_OPTIONS, prefs.work_mode)} />
          <PreferenceItem label="Desired salary" value={formatSalary(prefs.desired_salary)} />
        </dl>
      ) : (
        !loadError && (
          <div className={ui.empty}>
            <p>Tell recruiters what you&apos;re looking for.</p>
            <button type="button" className={`${ui.textLink} mt-2`} onClick={startEditing}>
              <Plus aria-hidden="true" className="size-4" />
              Set preferences
            </button>
          </div>
        )
      )}

      <div className="mt-6 border-t border-[#EEF0F3] pt-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#0E1726]">
          <Languages aria-hidden="true" className="size-4 text-[#1D4ED8]" />
          Languages
        </h3>

        {languages.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Languages">
            {languages.map((language) => (
              <li
                key={language.id}
                className="flex items-center gap-1 rounded-full border border-[#C7D5FA] bg-[#F3F6FE] py-1 pl-3 pr-1 text-sm font-semibold text-[#1D4ED8]"
              >
                {language.name}
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-60"
                  disabled={busyLanguage === language.id}
                  onClick={() => handleDeleteLanguage(language.id)}
                  aria-label={`Remove language ${language.name}`}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#6B7280]">No languages added yet.</p>
        )}

        <form className="mt-3 flex gap-2" onSubmit={handleAddLanguage} noValidate aria-label="Add language">
          <label htmlFor="pref-language" className="sr-only">
            Language
          </label>
          <input
            id="pref-language"
            className={ui.input}
            placeholder="e.g. French"
            value={languageName}
            onChange={(e) => setLanguageName(e.target.value)}
            aria-invalid={Boolean(languageError)}
          />
          <button type="submit" className={ui.addButton} disabled={busyLanguage === "new"}>
            <Plus aria-hidden="true" className="size-4" />
            {busyLanguage === "new" ? "Adding..." : "Add"}
          </button>
        </form>
        {languageError && <p className={`${ui.fieldError} mt-2`}>{languageError}</p>}
      </div>
    </section>
  );
}
