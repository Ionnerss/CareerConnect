"use client";

import { useState, type FormEvent } from "react";
import { addSkill, deleteSkill, updateSkill } from "@/app/profile/skills-actions";
import { profileSkillSchema } from "@/lib/validations/profile-skills";
import { Plus, Sparkles } from "lucide-react";
import { EntryActions, SectionHeader, ui } from "@/components/profile/profile-ui";

export const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;

const LEVEL_STYLES: Record<string, string> = {
  Beginner: "bg-[#F3F4F6] text-[#4B5563]",
  Intermediate: "bg-[#E8EEFD] text-[#1D4ED8]",
  Advanced: "bg-[#1D4ED8] text-white",
  Expert: "bg-[#0E1726] text-white",
};

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
    <section aria-labelledby="skills-heading" className={ui.card}>
      <SectionHeader
        id="skills-heading"
        icon={Sparkles}
        title="Skills"
        action={
          !isEditing && (
            <button type="button" className={ui.addButton} onClick={openAdd}>
              <Plus aria-hidden="true" className="size-4" />
              Add skill
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
          aria-label={editor.mode === "edit" ? "Edit skill" : "Add skill"}
        >
          <div className="space-y-1.5">
            <label htmlFor="skill-name" className={ui.label}>
              Skill
            </label>
            <input
              id="skill-name"
              className={ui.input}
              placeholder="e.g. React"
              value={values.name}
              onChange={(e) => updateField("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className={ui.fieldError}>{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="skill-proficiency" className={ui.label}>
              Proficiency
            </label>
            <select
              id="skill-proficiency"
              className={ui.input}
              value={values.proficiency}
              onChange={(e) => updateField("proficiency", e.target.value)}
              aria-invalid={Boolean(errors.proficiency)}
            >
              <option value="">Select a level</option>
              {PROFICIENCY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            {errors.proficiency && <p className={ui.fieldError}>{errors.proficiency}</p>}
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
        <p className={ui.empty}>No skills added yet.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#EEF0F3] bg-[#F9FAFB] py-1 pl-3 pr-1"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-[#0E1726]">{entry.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    LEVEL_STYLES[entry.proficiency] ?? LEVEL_STYLES.Beginner
                  }`}
                >
                  {entry.proficiency}
                </span>
              </div>

              {!isEditing && (
                <EntryActions
                  label={entry.name}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
