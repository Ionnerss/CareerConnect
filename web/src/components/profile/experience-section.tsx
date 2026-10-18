"use client";

import { useState, type FormEvent } from "react";
import {
  addExperience,
  deleteExperience,
  updateExperience,
} from "@/app/profile/experience-actions";
import { profileExperienceSchema } from "@/lib/validations/profile-experience";
import { formatDateRange } from "@/lib/profiles/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <section aria-labelledby="experience-heading" className="rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 id="experience-heading" className="text-lg font-semibold">
          Experience
        </h2>
        {!isEditing && (
          <Button type="button" variant="outline" onClick={openAdd}>
            Add experience
          </Button>
        )}
      </div>

      {loadError && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      {message && (
        <p role="status" className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {formError && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      {isEditing && (
        <form
          className="mt-4 space-y-4 rounded-md border p-4"
          onSubmit={handleSubmit}
          noValidate
          aria-label={editor.mode === "edit" ? "Edit experience" : "Add experience"}
        >
          <div className="space-y-1.5">
            <Label htmlFor="experience-role">Job title</Label>
            <Input
              id="experience-role"
              value={values.job_role}
              onChange={(e) => updateField("job_role", e.target.value)}
              aria-invalid={Boolean(errors.job_role)}
            />
            {errors.job_role && <p className="text-sm text-destructive">{errors.job_role}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="experience-company">Company</Label>
            <Input
              id="experience-company"
              value={values.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              aria-invalid={Boolean(errors.company_name)}
            />
            {errors.company_name && (
              <p className="text-sm text-destructive">{errors.company_name}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="experience-start">Start date</Label>
              <Input
                id="experience-start"
                type="date"
                value={values.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
                aria-invalid={Boolean(errors.start_date)}
              />
              {errors.start_date && (
                <p className="text-sm text-destructive">{errors.start_date}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="experience-end">End date (leave empty if current)</Label>
              <Input
                id="experience-end"
                type="date"
                value={values.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
                aria-invalid={Boolean(errors.end_date)}
              />
              {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="experience-description">Description</Label>
            <textarea
              id="experience-description"
              rows={3}
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
              aria-invalid={Boolean(errors.description)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editor.mode === "edit" ? "Save changes" : "Add"}
            </Button>
            <Button type="button" variant="outline" onClick={closeEditor} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {entries.length === 0 && !isEditing && !loadError ? (
        <p className="mt-4 text-sm text-muted-foreground">No experience added yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {entries.map((entry) => {
            const label = `${entry.job_role} at ${entry.company_name}`;

            return (
              <li key={entry.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{entry.job_role}</h3>
                    <p className="text-sm">{entry.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(entry.start_date, entry.end_date)}
                    </p>
                    {entry.description && (
                      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                        {entry.description}
                      </p>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex shrink-0 gap-2">
                      {confirmDeleteId === entry.id ? (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingId === entry.id}
                            onClick={() => handleDelete(entry.id)}
                            aria-label={`Confirm delete ${label}`}
                          >
                            {deletingId === entry.id ? "Deleting..." : "Confirm"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deletingId === entry.id}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Keep
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(entry)}
                            aria-label={`Edit ${label}`}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMessage(null);
                              setConfirmDeleteId(entry.id);
                            }}
                            aria-label={`Delete ${label}`}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
