"use client";

import { useState, type FormEvent } from "react";
import { addSkill, deleteSkill, updateSkill } from "@/app/profile/skills-actions";
import { profileSkillSchema } from "@/lib/validations/profile-skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;

export type SkillEntry = {
  id: string;
  name: string;
  proficiency: string;
};

type FormValues = {
  name: string;
  proficiency: string;
};

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormValues = { name: "", proficiency: "" };

const FIELD_MESSAGES: Record<FieldName, string> = {
  name: "Skill name is required (max 100 characters).",
  proficiency: "Please choose a proficiency level.",
};

function toEntry(raw: Record<string, unknown>): SkillEntry {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    proficiency: String(raw.proficiency ?? ""),
  };
}

// Alphabetical, matching the order the backend returns.
function sortEntries(entries: SkillEntry[]): SkillEntry[] {
  return [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

type EditorState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

export function SkillsSection({
  initialSkills,
  loadError = null,
}: {
  initialSkills: SkillEntry[];
  loadError?: string | null;
}) {
  const [entries, setEntries] = useState<SkillEntry[]>(sortEntries(initialSkills));
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

  function openEdit(entry: SkillEntry) {
    resetMessages();
    setConfirmDeleteId(null);
    setValues({ name: entry.name, proficiency: entry.proficiency });
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

    const result = profileSkillSchema.safeParse(values);

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
        editor.mode === "edit" ? await updateSkill(editor.id, values) : await addSkill(values);

      if (!response.success || !("skill" in response) || !response.skill) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to save your skill. Please try again.",
        );
        return;
      }

      const saved = toEntry(response.skill as Record<string, unknown>);

      setEntries((current) =>
        sortEntries(
          editor.mode === "edit"
            ? current.map((entry) => (entry.id === saved.id ? saved : entry))
            : [...current, saved],
        ),
      );
      setMessage(editor.mode === "edit" ? "Skill updated." : "Skill added.");
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
      const response = await deleteSkill(id);

      if (!response.success) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to delete your skill. Please try again.",
        );
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));
      setMessage("Skill removed.");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const isEditing = editor.mode !== "closed";

  return (
    <section aria-labelledby="skills-heading" className="rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 id="skills-heading" className="text-lg font-semibold">
          Skills
        </h2>
        {!isEditing && (
          <Button type="button" variant="outline" onClick={openAdd}>
            Add skill
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
          aria-label={editor.mode === "edit" ? "Edit skill" : "Add skill"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="skill-name">Skill</Label>
              <Input
                id="skill-name"
                placeholder="e.g. React"
                value={values.name}
                onChange={(e) => updateField("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-proficiency">Proficiency</Label>
              <select
                id="skill-proficiency"
                value={values.proficiency}
                onChange={(e) => updateField("proficiency", e.target.value)}
                aria-invalid={Boolean(errors.proficiency)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select a level</option>
                {PROFICIENCY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {errors.proficiency && (
                <p className="text-sm text-destructive">{errors.proficiency}</p>
              )}
            </div>
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
        <p className="mt-4 text-sm text-muted-foreground">No skills added yet.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{entry.name}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                  {entry.proficiency}
                </span>
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
                        aria-label={`Confirm delete ${entry.name}`}
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
                        aria-label={`Edit ${entry.name}`}
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
                        aria-label={`Delete ${entry.name}`}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
