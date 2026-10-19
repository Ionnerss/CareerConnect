"use client";

import { useState, type FormEvent } from "react";
import {
  addExperience,
  deleteExperience,
  updateExperience,
} from "@/app/profile/experience-actions";
import { profileExperienceSchema } from "@/lib/validations/profile-experience";
import { formatDateRange } from "@/lib/profiles/format-date";
import { Briefcase, Plus } from "lucide-react";
import { EntryActions, EntryBadge, SectionHeader, ui } from "@/components/profile/profile-ui";

export type ExperienceEntry = {
  id: string;
  company_name: string;
  job_role: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
};

type FormValues = {
  company_name: string;
  job_role: string;
  start_date: string;
  end_date: string;
  description: string;
};

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormValues = {
  company_name: "",
  job_role: "",
  start_date: "",
  end_date: "",
  description: "",
};

const FIELD_MESSAGES: Record<FieldName, string> = {
  company_name: "Company is required (max 200 characters).",
  job_role: "Job title is required (max 200 characters).",
  start_date: "Start date is required.",
  end_date: "End date must be on or after the start date.",
  description: "Description must be 500 words or fewer.",
};

function toFormValues(entry: ExperienceEntry): FormValues {
  return {
    company_name: entry.company_name,
    job_role: entry.job_role,
    start_date: entry.start_date,
    end_date: entry.end_date ?? "",
    description: entry.description ?? "",
  };
}

function toEntry(raw: Record<string, unknown>): ExperienceEntry {
  return {
    id: String(raw.id),
    company_name: String(raw.company_name ?? ""),
    job_role: String(raw.job_role ?? ""),
    start_date: String(raw.start_date ?? ""),
    end_date: (raw.end_date as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
  };
}

// Newest first, matching the order the backend returns.
function sortEntries(entries: ExperienceEntry[]): ExperienceEntry[] {
  return [...entries].sort((a, b) => b.start_date.localeCompare(a.start_date));
}

type EditorState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

export function ExperienceSection({
  initialExperience,
  loadError = null,
}: {
  initialExperience: ExperienceEntry[];
  loadError?: string | null;
}) {
  const [entries, setEntries] = useState<ExperienceEntry[]>(sortEntries(initialExperience));
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function resetMessages() {
    setErrors({});
    setFormError(null);
    setMessage(null);
  }

  function openAdd() {
    resetMessages();
    setConfirmDeleteId(null);
    setValues(EMPTY_FORM);
    setEditor({ mode: "add" });
  }

  function openEdit(entry: ExperienceEntry) {
    resetMessages();
    setConfirmDeleteId(null);
    setValues(toFormValues(entry));
    setEditor({ mode: "edit", id: entry.id });
  }

  function closeEditor() {
    setErrors({});
    setFormError(null);
    setEditor({ mode: "closed" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const result = profileExperienceSchema.safeParse(values);

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
      const response =
        editor.mode === "edit"
          ? await updateExperience(editor.id, values)
          : await addExperience(values);

      if (!response.success || !("experience" in response) || !response.experience) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to save your experience entry. Please try again.",
        );
        return;
      }

      const saved = toEntry(response.experience as Record<string, unknown>);

      setEntries((current) =>
        sortEntries(
          editor.mode === "edit"
            ? current.map((entry) => (entry.id === saved.id ? saved : entry))
            : [...current, saved],
        ),
      );
      setMessage(editor.mode === "edit" ? "Experience updated." : "Experience added.");
      setEditor({ mode: "closed" });
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setFormError(null);
    setMessage(null);
    setDeletingId(id);

    try {
      const response = await deleteExperience(id);

      if (!response.success) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to delete your experience entry. Please try again.",
        );
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));
      setMessage("Experience removed.");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const isEditing = editor.mode !== "closed";

  return (
    <section aria-labelledby="experience-heading" className={ui.card}>
      <SectionHeader
        id="experience-heading"
        icon={Briefcase}
        title="Experience"
        action={
          !isEditing && (
            <button type="button" className={ui.addButton} onClick={openAdd}>
              <Plus aria-hidden="true" className="size-4" />
              Add experience
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

      {isEditing && (
        <form
          className={ui.form}
          onSubmit={handleSubmit}
          noValidate
          aria-label={editor.mode === "edit" ? "Edit experience" : "Add experience"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="experience-role" className={ui.label}>
                Job title
              </label>
              <input
                id="experience-role"
                className={ui.input}
                placeholder="e.g. Frontend Developer"
                value={values.job_role}
                onChange={(e) => updateField("job_role", e.target.value)}
                aria-invalid={Boolean(errors.job_role)}
              />
              {errors.job_role && <p className={ui.fieldError}>{errors.job_role}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="experience-company" className={ui.label}>
                Company
              </label>
              <input
                id="experience-company"
                className={ui.input}
                placeholder="e.g. Shopify"
                value={values.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                aria-invalid={Boolean(errors.company_name)}
              />
              {errors.company_name && <p className={ui.fieldError}>{errors.company_name}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="experience-start" className={ui.label}>
                Start date
              </label>
              <input
                id="experience-start"
                type="date"
                className={ui.input}
                value={values.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
                aria-invalid={Boolean(errors.start_date)}
              />
              {errors.start_date && <p className={ui.fieldError}>{errors.start_date}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="experience-end" className={ui.label}>
                End date (leave empty if current)
              </label>
              <input
                id="experience-end"
                type="date"
                className={ui.input}
                value={values.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
                aria-invalid={Boolean(errors.end_date)}
              />
              {errors.end_date && <p className={ui.fieldError}>{errors.end_date}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="experience-description" className={ui.label}>
              Description
            </label>
            <textarea
              id="experience-description"
              rows={3}
              className={ui.textarea}
              placeholder="What you worked on and what you achieved..."
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && <p className={ui.fieldError}>{errors.description}</p>}
          </div>

          <div className="flex gap-3">
            <button type="submit" className={ui.primaryButton} disabled={isSaving}>
              {isSaving ? "Saving..." : editor.mode === "edit" ? "Save changes" : "Add"}
            </button>
            <button
              type="button"
              className={ui.secondaryButton}
              onClick={closeEditor}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 && !isEditing && !loadError ? (
        <p className={ui.empty}>No experience added yet.</p>
      ) : (
        <ul className="mt-5 divide-y divide-[#EEF0F3]">
          {entries.map((entry) => {
            const label = `${entry.job_role} at ${entry.company_name}`;

            return (
              <li key={entry.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <EntryBadge text={entry.company_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className={ui.entryTitle}>{entry.job_role}</h3>
                      <p className={ui.entrySubtitle}>{entry.company_name}</p>
                      <p className={`${ui.entryMeta} mt-1`}>
                        {formatDateRange(entry.start_date, entry.end_date)}
                      </p>
                    </div>
                    {!isEditing && (
                      <EntryActions
                        label={label}
                        confirming={confirmDeleteId === entry.id}
                        busy={deletingId === entry.id}
                        onEdit={() => openEdit(entry)}
                        onDelete={() => {
                          setMessage(null);
                          setConfirmDeleteId(entry.id);
                        }}
                        onConfirm={() => handleDelete(entry.id)}
                        onCancel={() => setConfirmDeleteId(null)}
                      />
                    )}
                  </div>
                  {entry.description && <p className={ui.entryBody}>{entry.description}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
