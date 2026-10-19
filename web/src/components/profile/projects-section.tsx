"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  addLink,
  addProject,
  deleteLink,
  deleteProject,
  getImageUrl,
  updateProject,
} from "@/app/profile/projects-actions";
import {
  profileProjectLinkSchema,
  profileProjectSchema,
} from "@/lib/validations/profile-projects";
import { ExternalLink, FolderKanban, ImagePlus, Link2, Plus, X } from "lucide-react";
import { EntryActions, SectionHeader, ui } from "@/components/profile/profile-ui";

export type ProjectLink = {
  id: string;
  label: string;
  url: string;
};

export type ProjectImage = {
  id: string;
  url: string | null;
  alt_text: string | null;
};

export type ProjectEntry = {
  id: string;
  name: string;
  short_description: string;
  links: ProjectLink[];
  images: ProjectImage[];
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ProjectValues = { name: string; short_description: string };
type ProjectField = keyof ProjectValues;
type LinkValues = { label: string; url: string };
type LinkField = keyof LinkValues;

const EMPTY_PROJECT: ProjectValues = { name: "", short_description: "" };
const EMPTY_LINK: LinkValues = { label: "", url: "" };

const PROJECT_MESSAGES: Record<ProjectField, string> = {
  name: "Project name is required (max 150 characters).",
  short_description: "Description is required (max 500 characters).",
};

const LINK_MESSAGES: Record<LinkField, string> = {
  label: "Link label is required (max 100 characters).",
  url: "Enter a valid URL starting with http:// or https://.",
};

function toLink(raw: Record<string, unknown>): ProjectLink {
  return {
    id: String(raw.id),
    label: String(raw.label ?? ""),
    url: String(raw.url ?? ""),
  };
}

function firstErrors<K extends string>(
  issues: { path: PropertyKey[] }[],
  messages: Record<K, string>,
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as K;
    if (key in messages && !errors[key]) {
      errors[key] = messages[key];
    }
  }
  return errors;
}

type EditorState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

export function ProjectsSection({
  initialProjects,
  loadError = null,
}: {
  initialProjects: ProjectEntry[];
  loadError?: string | null;
}) {
  const [projects, setProjects] = useState<ProjectEntry[]>(initialProjects);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [values, setValues] = useState<ProjectValues>(EMPTY_PROJECT);
  const [errors, setErrors] = useState<Partial<Record<ProjectField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Link form, shown under one project at a time.
  const [linkProjectId, setLinkProjectId] = useState<string | null>(null);
  const [linkValues, setLinkValues] = useState<LinkValues>(EMPTY_LINK);
  const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkField, string>>>({});

  function resetMessages() {
    setErrors({});
    setLinkErrors({});
    setFormError(null);
    setMessage(null);
  }

  function openAdd() {
    resetMessages();
    setConfirmDeleteId(null);
    setLinkProjectId(null);
    setValues(EMPTY_PROJECT);
    setEditor({ mode: "add" });
  }

  function openEdit(project: ProjectEntry) {
    resetMessages();
    setConfirmDeleteId(null);
    setLinkProjectId(null);
    setValues({ name: project.name, short_description: project.short_description });
    setEditor({ mode: "edit", id: project.id });
  }

  function closeEditor() {
    setErrors({});
    setFormError(null);
    setEditor({ mode: "closed" });
  }

  function openLinkForm(projectId: string) {
    resetMessages();
    setConfirmDeleteId(null);
    setLinkValues(EMPTY_LINK);
    setLinkProjectId(projectId);
  }

  async function handleProjectSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const result = profileProjectSchema.safeParse(values);
    if (!result.success) {
      setErrors(firstErrors(result.error.issues, PROJECT_MESSAGES));
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const response =
        editor.mode === "edit"
          ? await updateProject(editor.id, values)
          : await addProject(values);

      if (!response.success || !("project" in response) || !response.project) {
        setFormError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to save your project. Please try again.",
        );
        return;
      }

      const raw = response.project as Record<string, unknown>;
      const saved = {
        id: String(raw.id),
        name: String(raw.name ?? ""),
        short_description: String(raw.short_description ?? ""),
      };

      setProjects((current) =>
        editor.mode === "edit"
          ? current.map((project) =>
              project.id === saved.id ? { ...project, ...saved } : project,
            )
          : [{ ...saved, links: [], images: [] }, ...current],
      );
      setMessage(editor.mode === "edit" ? "Project updated." : "Project added.");
      setEditor({ mode: "closed" });
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProject(id: string) {
    setFormError(null);
    setMessage(null);
    setBusyId(id);

    try {
      const response = await deleteProject(id);

      if (!response.success) {
        setFormError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to delete your project. Please try again.",
        );
        return;
      }

      setProjects((current) => current.filter((project) => project.id !== id));
      setMessage("Project removed.");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleLinkSubmit(e: FormEvent, projectId: string) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const result = profileProjectLinkSchema.safeParse(linkValues);
    if (!result.success) {
      setLinkErrors(firstErrors(result.error.issues, LINK_MESSAGES));
      return;
    }

    setLinkErrors({});
    setBusyId(projectId);

    try {
      const response = await addLink(projectId, linkValues);

      if (!response.success || !("link" in response) || !response.link) {
        setFormError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to add your project link. Please try again.",
        );
        return;
      }

      const link = toLink(response.link as Record<string, unknown>);
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, links: [link, ...project.links] } : project,
        ),
      );
      setMessage("Link added.");
      setLinkProjectId(null);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteLink(projectId: string, linkId: string) {
    setFormError(null);
    setMessage(null);
    setBusyId(linkId);

    try {
      const response = await deleteLink(linkId);

      if (!response.success) {
        setFormError(
          "error" in response && response.error
            ? String(response.error)
            : "Unable to delete your project link. Please try again.",
        );
        return;
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? { ...project, links: project.links.filter((link) => link.id !== linkId) }
            : project,
        ),
      );
      setMessage("Link removed.");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleImageChange(projectId: string, e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setFormError(null);
    setMessage(null);

    if (!IMAGE_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      setFormError("Please choose a JPEG, PNG, or WebP image of 5 MB or smaller.");
      input.value = "";
      return;
    }

    setBusyId(projectId);

    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("file", file);

      const res = await fetch("/api/project-images", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success || !data.image) {
        setFormError(data.error ?? "Unable to upload your project image. Please try again.");
        return;
      }

      const imageId = String(data.image.id);
      let url: string | null = null;

      try {
        const signed = await getImageUrl(imageId);
        url = signed.success && "url" in signed ? String(signed.url) : null;
      } catch {
        url = null;
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                images: [...project.images, { id: imageId, url, alt_text: data.image.alt_text ?? null }],
              }
            : project,
        ),
      );
      setMessage("Image added.");
    } catch {
      setFormError("Unable to upload your project image. Please try again.");
    } finally {
      setBusyId(null);
      input.value = "";
    }
  }

  async function handleDeleteImage(projectId: string, imageId: string) {
    setFormError(null);
    setMessage(null);
    setBusyId(imageId);

    try {
      const res = await fetch("/api/project-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error ?? "Unable to delete your project image. Please try again.");
        return;
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? { ...project, images: project.images.filter((image) => image.id !== imageId) }
            : project,
        ),
      );
      setMessage("Image removed.");
    } catch {
      setFormError("Unable to delete your project image. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const isEditing = editor.mode !== "closed";

  return (
    <section aria-labelledby="projects-heading" className={ui.card}>
      <SectionHeader
        id="projects-heading"
        icon={FolderKanban}
        title="Projects"
        action={
          !isEditing && (
            <button type="button" className={ui.addButton} onClick={openAdd}>
              <Plus aria-hidden="true" className="size-4" />
              Add project
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
          onSubmit={handleProjectSubmit}
          noValidate
          aria-label={editor.mode === "edit" ? "Edit project" : "Add project"}
        >
          <div className="space-y-1.5">
            <label htmlFor="project-name" className={ui.label}>
              Project name
            </label>
            <input
              id="project-name"
              className={ui.input}
              placeholder="e.g. CareerConnect"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className={ui.fieldError}>{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="project-description" className={ui.label}>
              Short description
            </label>
            <textarea
              id="project-description"
              rows={3}
              className={ui.textarea}
              placeholder="What it does, what you built, the tech you used..."
              value={values.short_description}
              onChange={(e) => setValues((v) => ({ ...v, short_description: e.target.value }))}
              aria-invalid={Boolean(errors.short_description)}
            />
            {errors.short_description && (
              <p className={ui.fieldError}>{errors.short_description}</p>
            )}
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

      {projects.length === 0 && !isEditing && !loadError ? (
        <p className={ui.empty}>No projects added yet.</p>
      ) : (
        <ul className="mt-5 grid gap-4">
          {projects.map((project) => (
            <li
              key={project.id}
              aria-label={project.name}
              className="rounded-xl border border-[#EEF0F3] bg-[#F9FAFB] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={ui.entryTitle}>{project.name}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#4B5563]">
                    {project.short_description}
                  </p>
                </div>

                {!isEditing && (
                  <EntryActions
                    label={project.name}
                    confirming={confirmDeleteId === project.id}
                    busy={busyId === project.id}
                    onEdit={() => openEdit(project)}
                    onDelete={() => {
                      setMessage(null);
                      setLinkProjectId(null);
                      setConfirmDeleteId(project.id);
                    }}
                    onConfirm={() => handleDeleteProject(project.id)}
                    onCancel={() => setConfirmDeleteId(null)}
                  />
                )}
              </div>

              {project.images.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3" aria-label={`${project.name} images`}>
                  {project.images.map((image, index) => (
                    <li key={image.id} className="group relative">
                      {image.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.url}
                          alt={image.alt_text || `${project.name} screenshot ${index + 1}`}
                          className="h-28 w-44 rounded-lg border border-[#E3E6EB] bg-white object-cover"
                        />
                      ) : (
                        <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-[#E3E6EB] bg-white text-xs text-[#6B7280]">
                          Image unavailable
                        </div>
                      )}
                      {!isEditing && (
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[#0E1726]/80 text-white transition-colors hover:bg-[#DC2626] disabled:opacity-60"
                          disabled={busyId === image.id}
                          onClick={() => handleDeleteImage(project.id, image.id)}
                          aria-label={`Remove image ${index + 1} from ${project.name}`}
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {project.links.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${project.name} links`}>
                  {project.links.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-center gap-1 rounded-full border border-[#C7D5FA] bg-white py-1 pl-3 pr-1 text-sm"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                      >
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                        {link.label}
                      </a>
                      {!isEditing && (
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-60"
                          disabled={busyId === link.id}
                          onClick={() => handleDeleteLink(project.id, link.id)}
                          aria-label={`Remove link ${link.label}`}
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!isEditing && linkProjectId !== project.id && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={ui.secondaryButton.replace("h-10", "h-9")}
                    onClick={() => openLinkForm(project.id)}
                    aria-label={`Add link to ${project.name}`}
                  >
                    <Link2 aria-hidden="true" className="size-4" />
                    Add link
                  </button>
                  <label
                    className={`${ui.secondaryButton.replace("h-10", "h-9")} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1D4ED8]`}
                  >
                    <ImagePlus aria-hidden="true" className="size-4" />
                    {busyId === project.id ? "Uploading..." : "Add image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busyId === project.id}
                      onChange={(e) => handleImageChange(project.id, e)}
                      aria-label={`Add image to ${project.name}`}
                    />
                  </label>
                </div>
              )}

              {!isEditing && linkProjectId === project.id && (
                <form
                  className="mt-4 space-y-3 rounded-xl border border-[#E3E6EB] bg-white p-4"
                  onSubmit={(e) => handleLinkSubmit(e, project.id)}
                  noValidate
                  aria-label={`Add link to ${project.name}`}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor={`link-label-${project.id}`} className={ui.label}>
                        Link label
                      </label>
                      <input
                        id={`link-label-${project.id}`}
                        className={ui.input}
                        placeholder="e.g. GitHub"
                        value={linkValues.label}
                        onChange={(e) => setLinkValues((v) => ({ ...v, label: e.target.value }))}
                        aria-invalid={Boolean(linkErrors.label)}
                      />
                      {linkErrors.label && <p className={ui.fieldError}>{linkErrors.label}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`link-url-${project.id}`} className={ui.label}>
                        URL
                      </label>
                      <input
                        id={`link-url-${project.id}`}
                        type="url"
                        className={ui.input}
                        placeholder="https://"
                        value={linkValues.url}
                        onChange={(e) => setLinkValues((v) => ({ ...v, url: e.target.value }))}
                        aria-invalid={Boolean(linkErrors.url)}
                      />
                      {linkErrors.url && <p className={ui.fieldError}>{linkErrors.url}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className={ui.primaryButton} disabled={busyId === project.id}>
                      {busyId === project.id ? "Saving..." : "Save link"}
                    </button>
                    <button
                      type="button"
                      className={ui.secondaryButton}
                      onClick={() => {
                        setLinkErrors({});
                        setLinkProjectId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
