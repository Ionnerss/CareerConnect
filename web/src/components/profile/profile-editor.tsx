"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { saveProfile } from "@/app/profile/actions";
import { profileSchema } from "@/lib/validations/profile";
import { getInitials, getProfileImageUrl } from "@/lib/profiles/profile-image-url";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProfileData = {
  full_name: string | null;
  bio: string | null;
  location: string | null;
  contact_email: string | null;
  avatar_path: string | null;
  background_path: string | null;
};

type FormValues = {
  full_name: string;
  bio: string;
  location: string;
  contact_email: string;
};

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;
type ImageKind = "avatar" | "background";

// Page where the user manages their resumes and cover letters.
export const RESUMES_PAGE_PATH = "/upload-resume";

const FIELD_MESSAGES: Record<FieldName, string> = {
  full_name: "Full name is required (max 100 characters).",
  bio: "Bio must be 1000 characters or fewer.",
  location: "Location must be 150 characters or fewer.",
  contact_email: "Enter a valid email address or leave it empty.",
};

function toFormValues(profile: ProfileData): FormValues {
  return {
    full_name: profile.full_name ?? "",
    bio: profile.bio ?? "",
    location: profile.location ?? "",
    contact_email: profile.contact_email ?? "",
  };
}

export function ProfileEditor({ initialProfile }: { initialProfile: ProfileData }) {
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [values, setValues] = useState<FormValues>(toFormValues(initialProfile));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const avatarUrl = getProfileImageUrl(profile.avatar_path);
  const bannerUrl = getProfileImageUrl(profile.background_path);

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function startEditing() {
    setValues(toFormValues(profile));
    setErrors({});
    setFormError(null);
    setMessage(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setValues(toFormValues(profile));
    setErrors({});
    setFormError(null);
    setIsEditing(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const result = profileSchema.safeParse(values);

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
      const response = await saveProfile(values);

      if (!response.success || !("profile" in response) || !response.profile) {
        setFormError(
          "error" in response && response.error
            ? response.error
            : "Unable to save your profile. Please try again.",
        );
        return;
      }

      const saved = response.profile;

      setProfile((current) => ({
        ...current,
        full_name: saved.full_name ?? null,
        bio: saved.bio ?? null,
        location: saved.location ?? null,
        contact_email: saved.contact_email ?? null,
      }));
      setIsEditing(false);
      setMessage("Profile saved.");
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageChange(kind: ImageKind, e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setFormError(null);
    setMessage(null);
    setUploading(kind);

    try {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);

      const res = await fetch("/api/profile-images", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error ?? "Unable to upload your image. Please try again.");
        return;
      }

      setProfile((current) => ({
        ...current,
        avatar_path: data.profile.avatar_path ?? null,
        background_path: data.profile.background_path ?? null,
      }));
      setMessage(kind === "avatar" ? "Profile photo updated." : "Banner updated.");
    } catch {
      setFormError("Unable to upload your image. Please try again.");
    } finally {
      setUploading(null);
      // Allow choosing the same file again later.
      input.value = "";
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border shadow-sm">
      {/* Banner */}
      <div className="relative h-36 bg-muted">
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="Profile banner" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="-mt-12 flex items-end justify-between gap-4">
          <div className="relative z-10 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-secondary text-2xl font-semibold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{getInitials(profile.full_name)}</span>
            )}
          </div>

          {!isEditing && (
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href={RESUMES_PAGE_PATH}
                className={buttonVariants({ variant: "outline" })}
              >
                Resumes &amp; cover letters
              </Link>
              <Button type="button" variant="outline" onClick={startEditing}>
                Edit profile
              </Button>
            </div>
          )}
        </div>

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

        {!isEditing ? (
          <div className="mt-4 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {profile.full_name || "Unnamed user"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {profile.location || "No location added"}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium">About</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {profile.bio || "No bio yet."}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium">Contact email</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.contact_email || "No contact email added"}
              </p>
            </div>
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={values.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                aria-invalid={Boolean(errors.full_name)}
              />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={values.location}
                onChange={(e) => updateField("location", e.target.value)}
                aria-invalid={Boolean(errors.location)}
              />
              {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Contact email</Label>
              <Input
                id="contact_email"
                type="email"
                value={values.contact_email}
                onChange={(e) => updateField("contact_email", e.target.value)}
                aria-invalid={Boolean(errors.contact_email)}
              />
              {errors.contact_email && (
                <p className="text-sm text-destructive">{errors.contact_email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                rows={4}
                value={values.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                aria-invalid={Boolean(errors.bio)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {errors.bio && <p className="text-sm text-destructive">{errors.bio}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatar">Profile photo</Label>
              <input
                id="avatar"
                type="file"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm file:font-medium"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading !== null}
                onChange={(e) => handleImageChange("avatar", e)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="background">Banner image</Label>
              <input
                id="background"
                type="file"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm file:font-medium"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading !== null}
                onChange={(e) => handleImageChange("background", e)}
              />
            </div>

            {uploading && (
              <p className="text-sm text-muted-foreground">Uploading image...</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isSaving || uploading !== null}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
