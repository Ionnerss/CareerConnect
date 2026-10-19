"use server";

import {
  addCurrentProject,
  deleteCurrentProject,
  updateCurrentProject,
} from "@/lib/profiles/profile-projects";
import { addProjectLink, deleteProjectLink } from "@/lib/profiles/profile-project-links";
import { getProjectImageUrl } from "@/lib/profiles/profile-project-images";

export async function addProject(input: unknown) {
  return await addCurrentProject(input);
}

export async function updateProject(projectId: string, input: unknown) {
  return await updateCurrentProject(projectId, input);
}

export async function deleteProject(projectId: string) {
  return await deleteCurrentProject(projectId);
}

export async function addLink(projectId: string, input: unknown) {
  return await addProjectLink(projectId, input);
}

export async function deleteLink(linkId: string) {
  return await deleteProjectLink(linkId);
}

// Project images live in a private bucket, so each one needs a short-lived signed URL.
export async function getImageUrl(imageId: string) {
  return await getProjectImageUrl(imageId);
}
