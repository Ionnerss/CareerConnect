"use client";

import { useState, type FormEvent } from "react";
import {
  addEducation,
  deleteEducation,
  updateEducation,
} from "@/app/profile/education-actions";
import { profileEducationSchema } from "@/lib/validations/profile-education";
import { formatDateRange } from "@/lib/profiles/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EducationEntry = {
  id: string;
  school: string;
  degree: string;
  field_of_study: string | null;
  start_date: string;
  end_date: string | null;
  description: string | null;
};

export const DEGREE_OPTIONS = [
  "High School Diploma",
  "DEC (CEGEP)",
  "Certificate / Diploma",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate (PhD)",
] as const;

const OTHER_DEGREE = "Other";

type FormValues = {
  school: string;
  degree_choice: string;
  degree_other: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  description: string;
};

type FieldName =
  | "school"
  | "degree"
  | "field_of_study"
  | "start_date"
  | "end_date"
  | "description";
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormValues = {
  school: "",
  degree_choice: "",
  degree_other: "",
  field_of_study: "",
  start_date: "",
  end_date: "",
  description: "",
};

const FIELD_MESSAGES: Record<FieldName, string> = {
  school: "School is required (max 200 characters).",
  degree: "Please choose a degree (or describe it under Other, max 200 characters).",
  field_of_study: "Field of study must be 200 characters or fewer.",
  start_date: "Start date is required.",
  end_date: "End date must be on or after the start date.",
  description: "Description must be 500 words or fewer.",
};

function toFormValues(entry: EducationEntry): FormValues {
  const isListed = (DEGREE_OPTIONS as readonly string[]).includes(entry.degree);

  return {
    school: entry.school,
    degree_choice: isListed ? entry.degree : OTHER_DEGREE,
    degree_other: isListed ? "" : entry.degree,
    field_of_study: entry.field_of_study ?? "",
    start_date: entry.start_date,
    end_date: entry.end_date ?? "",
    description: entry.description ?? "",
  };
}

// What gets sent to the backend: the chosen degree, or the typed one for "Other".
function toPayload(values: FormValues) {
  return {
    school: values.school,
    degree: values.degree_choice === OTHER_DEGREE ? values.degree_other : values.degree_choice,
    field_of_study: values.field_of_study,
    start_date: values.start_date,
    end_date: values.end_date,
    description: values.description,
  };
}

function toEntry(raw: Record<string, unknown>): EducationEntry {
  return {
    id: String(raw.id),
    school: String(raw.school ?? ""),
    degree: String(raw.degree ?? ""),
    field_of_study: (raw.field_of_study as string | null) ?? null,
    start_date: String(raw.start_date ?? ""),
    end_date: (raw.end_date as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
  };
}

// Newest first, matching the order the backend returns.
function sortEntries(entries: EducationEntry[]): EducationEntry[] {
  return [...entries].sort((a, b) => b.start_date.localeCompare(a.start_date));
}

type EditorState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

export function EducationSection({
  initialEducation,
  loadError = null,
}: {
  initialEducation: EducationEntry[];
  loadError?: string | null;
}) {
  const [entries, setEntries] = useState<EducationEntry[]>(sortEntries(initialEducation));
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateField(field: keyof FormValues, value: string) {
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

  function openEdit(entry: EducationEntry) {
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

    const payload = toPayload(values);
    const result = profileEducationSchema.safeParse(payload);

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
          ? await updateEducation(editor.id, payload)
          : await addEducation(payload);

      if (!response.success || !("education" in response) || !response.education) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to save your education entry. Please try again.",
        );
        return;
      }

      const saved = toEntry(response.education as Record<string, unknown>);

      setEntries((current) =>
        sortEntries(
          editor.mode === "edit"
            ? current.map((entry) => (entry.id === saved.id ? saved : entry))
            : [...current, saved],
        ),
      );
      setMessage(editor.mode === "edit" ? "Education updated." : "Education added.");
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
      const response = await deleteEducation(id);

      if (!response.success) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to delete your education entry. Please try again.",
        );
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));
      setMessage("Education removed.");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const isEditing = editor.mode !== "closed";

  return (
    <section aria-labelledby="education-heading" className="rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 id="education-heading" className="text-lg font-semibold">
          Education
        </h2>
        {!isEditing && (
          <Button type="button" variant="outline" onClick={openAdd}>
            Add education
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
          aria-label={editor.mode === "edit" ? "Edit education" : "Add education"}
        >
          <div className="space-y-1.5">
            <Label htmlFor="education-school">School</Label>
            <Input
              id="education-school"
              value={values.school}
              onChange={(e) => updateField("school", e.target.value)}
              aria-invalid={Boolean(errors.school)}
            />
            {errors.school && <p className="text-sm text-destructive">{errors.school}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="education-degree">Degree</Label>
            <select
              id="education-degree"
              value={values.degree_choice}
              onChange={(e) => updateField("degree_choice", e.target.value)}
              aria-invalid={Boolean(errors.degree)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a degree</option>
              {DEGREE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value={OTHER_DEGREE}>Other</option>
            </select>
            {values.degree_choice === OTHER_DEGREE && (
              <Input
                id="education-degree-other"
                aria-label="Other degree"
                placeholder="e.g. Undergraduate certificate"
                value={values.degree_other}
                onChange={(e) => updateField("degree_other", e.target.value)}
                aria-invalid={Boolean(errors.degree)}
              />
            )}
            {errors.degree && <p className="text-sm text-destructive">{errors.degree}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="education-field">Field of study</Label>
            <Input
              id="education-field"
              value={values.field_of_study}
              onChange={(e) => updateField("field_of_study", e.target.value)}
              aria-invalid={Boolean(errors.field_of_study)}
            />
            {errors.field_of_study && (
              <p className="text-sm text-destructive">{errors.field_of_study}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="education-start">Start date</Label>
              <Input
                id="education-start"
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
              <Label htmlFor="education-end">End date (leave empty if ongoing)</Label>
              <Input
                id="education-end"
                type="date"
                value={values.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
                aria-invalid={Boolean(errors.end_date)}
              />
              {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="education-description">Description</Label>
            <textarea
              id="education-description"
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
        <p className="mt-4 text-sm text-muted-foreground">No education added yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{entry.school}</h3>
                  <p className="text-sm">
                    {entry.field_of_study
                      ? `${entry.degree}, ${entry.field_of_study}`
                      : entry.degree}
                  </p>
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
                          aria-label={`Confirm delete ${entry.school}`}
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
                          aria-label={`Edit ${entry.school}`}
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
                          aria-label={`Delete ${entry.school}`}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
