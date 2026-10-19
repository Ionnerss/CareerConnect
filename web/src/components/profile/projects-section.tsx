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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <section aria-labelledby="projects-heading" className="rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 id="projects-heading" className="text-lg font-semibold">
          Projects
        </h2>
        {!isEditing && (
          <Button type="button" variant="outline" onClick={openAdd}>
            Add project
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
          onSubmit={handleProjectSubmit}
          noValidate
          aria-label={editor.mode === "edit" ? "Edit project" : "Add project"}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Short description</Label>
            <textarea
              id="project-description"
              rows={3}
              value={values.short_description}
              onChange={(e) => setValues((v) => ({ ...v, short_description: e.target.value }))}
              aria-invalid={Boolean(errors.short_description)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {errors.short_description && (
              <p className="text-sm text-destructive">{errors.short_description}</p>
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

      {projects.length === 0 && !isEditing && !loadError ? (
        <p className="mt-4 text-sm text-muted-foreground">No projects added yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {projects.map((project) => (
            <li
              key={project.id}
              aria-label={project.name}
              className="border-t pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-medium">{project.name}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {project.short_description}
                  </p>
                </div>

                {!isEditing && (
                  <div className="flex shrink-0 gap-2">
                    {confirmDeleteId === project.id ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busyId === project.id}
                          onClick={() => handleDeleteProject(project.id)}
                          aria-label={`Confirm delete ${project.name}`}
                        >
                          {busyId === project.id ? "Deleting..." : "Confirm"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === project.id}
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
                          onClick={() => openEdit(project)}
                          aria-label={`Edit ${project.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMessage(null);
                            setLinkProjectId(null);
                            setConfirmDeleteId(project.id);
                          }}
                          aria-label={`Delete ${project.name}`}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {project.images.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3" aria-label={`${project.name} images`}>
                  {project.images.map((image, index) => (
                    <li key={image.id} className="relative">
                      {image.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.url}
                          alt={image.alt_text || `${project.name} screenshot ${index + 1}`}
                          className="h-24 w-36 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-36 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                          Image unavailable
                        </div>
                      )}
                      {!isEditing && (
                        <button
                          type="button"
                          className="mt-1 block text-xs text-muted-foreground hover:text-destructive"
                          disabled={busyId === image.id}
                          onClick={() => handleDeleteImage(project.id, image.id)}
                          aria-label={`Remove image ${index + 1} from ${project.name}`}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {project.links.length > 0 && (
                <ul className="mt-2 space-y-1" aria-label={`${project.name} links`}>
                  {project.links.map((link) => (
                    <li key={link.id} className="flex items-center gap-2 text-sm">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {link.label}
                      </a>
                      {!isEditing && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          disabled={busyId === link.id}
                          onClick={() => handleDeleteLink(project.id, link.id)}
                          aria-label={`Remove link ${link.label}`}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!isEditing && linkProjectId !== project.id && (
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => openLinkForm(project.id)}
                    aria-label={`Add link to ${project.name}`}
                  >
                    + Add link
                  </button>
                  <label className="cursor-pointer text-primary underline-offset-4 hover:underline">
                    {busyId === project.id ? "Uploading..." : "+ Add image"}
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
                  className="mt-3 space-y-3 rounded-md border p-3"
                  onSubmit={(e) => handleLinkSubmit(e, project.id)}
                  noValidate
                  aria-label={`Add link to ${project.name}`}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`link-label-${project.id}`}>Link label</Label>
                      <Input
                        id={`link-label-${project.id}`}
                        placeholder="e.g. GitHub"
                        value={linkValues.label}
                        onChange={(e) => setLinkValues((v) => ({ ...v, label: e.target.value }))}
                        aria-invalid={Boolean(linkErrors.label)}
                      />
                      {linkErrors.label && (
                        <p className="text-sm text-destructive">{linkErrors.label}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`link-url-${project.id}`}>URL</Label>
                      <Input
                        id={`link-url-${project.id}`}
                        type="url"
                        placeholder="https://"
                        value={linkValues.url}
                        onChange={(e) => setLinkValues((v) => ({ ...v, url: e.target.value }))}
                        aria-invalid={Boolean(linkErrors.url)}
                      />
                      {linkErrors.url && (
                        <p className="text-sm text-destructive">{linkErrors.url}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={busyId === project.id}>
                      {busyId === project.id ? "Saving..." : "Save link"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkErrors({});
                        setLinkProjectId(null);
                      }}
                    >
                      Cancel
                    </Button>
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
