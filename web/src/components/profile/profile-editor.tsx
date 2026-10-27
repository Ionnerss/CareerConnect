"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { saveProfile } from "@/app/profile/actions";
import { profileSchema } from "@/lib/validations/profile";
import { getInitials, getProfileImageUrl } from "@/lib/profiles/profile-image-url";
import { FileText, Mail, MapPin, Pencil } from "lucide-react";
import { ui } from "@/components/profile/profile-ui";

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
    <section
      aria-label="Profile overview"
      className="overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white shadow-[0_10px_30px_-18px_rgba(14,23,38,0.35)]"
    >
      {/* Banner: the user's image, or the dashboard gradient */}
      <div className="relative h-40 bg-[#1D4ED8] [background-image:linear-gradient(135deg,#1D4ED8,#0E1726)] sm:h-48">
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="Profile banner" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
          <div className="relative z-10 flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#0E1726] text-3xl font-extrabold text-white shadow-md">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{getInitials(profile.full_name)}</span>
            )}
          </div>

          {!isEditing && (
            <div className="flex flex-wrap gap-2">
              <Link href={RESUMES_PAGE_PATH} className={ui.secondaryButton}>
                <FileText aria-hidden="true" className="size-4" />
                Resumes &amp; cover letters
              </Link>
              <button type="button" className={ui.primaryButton} onClick={startEditing}>
                <Pencil aria-hidden="true" className="size-4" />
                Edit profile
              </button>
            </div>
          )}
        </div>

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

        {!isEditing ? (
          <div className="mt-5 space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0E1726] sm:text-3xl">
                {profile.full_name || "Unnamed user"}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#4B5563]">
                <p className="flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-4 text-[#6B7280]" />
                  <span>{profile.location || "No location added"}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Mail aria-hidden="true" className="size-4 text-[#6B7280]" />
                  <span className="sr-only">Contact email: </span>
                  <span>{profile.contact_email || "No contact email added"}</span>
                </p>
              </div>
            </div>

            <div className="border-t border-[#EEF0F3] pt-5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#4B5563]">
                About
              </h3>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#1F2937]">
                {profile.bio || "No bio yet."}
              </p>
            </div>
          </div>
        ) : (
          <form className={ui.form} onSubmit={handleSubmit} noValidate aria-label="Edit profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="full_name" className={ui.label}>
                  Full name
                </label>
                <input
                  id="full_name"
                  className={ui.input}
                  value={values.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  aria-invalid={Boolean(errors.full_name)}
                />
                {errors.full_name && <p className={ui.fieldError}>{errors.full_name}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="location" className={ui.label}>
                  Location
                </label>
                <input
                  id="location"
                  className={ui.input}
                  placeholder="e.g. Montreal, QC"
                  value={values.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  aria-invalid={Boolean(errors.location)}
                />
                {errors.location && <p className={ui.fieldError}>{errors.location}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact_email" className={ui.label}>
                Contact email
              </label>
              <input
                id="contact_email"
                type="email"
                className={ui.input}
                value={values.contact_email}
                onChange={(e) => updateField("contact_email", e.target.value)}
                aria-invalid={Boolean(errors.contact_email)}
              />
              {errors.contact_email && <p className={ui.fieldError}>{errors.contact_email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bio" className={ui.label}>
                Bio
              </label>
              <textarea
                id="bio"
                rows={4}
                className={ui.textarea}
                placeholder="A few sentences about you, your goals and what you're looking for."
                value={values.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                aria-invalid={Boolean(errors.bio)}
              />
              {errors.bio && <p className={ui.fieldError}>{errors.bio}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="avatar" className={ui.label}>
                  Profile photo
                </label>
                <input
                  id="avatar"
                  type="file"
                  className={ui.fileInput}
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading !== null}
                  onChange={(e) => handleImageChange("avatar", e)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="background" className={ui.label}>
                  Banner image
                </label>
                <input
                  id="background"
                  type="file"
                  className={ui.fileInput}
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading !== null}
                  onChange={(e) => handleImageChange("background", e)}
                />
              </div>
            </div>

            {uploading && <p className="text-sm text-[#4B5563]">Uploading image...</p>}

            <div className="flex gap-3">
              <button type="submit" className={ui.primaryButton} disabled={isSaving || uploading !== null}>
                {isSaving ? "Saving..." : "Save changes"}
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
        )}
      </div>
    </section>
  );
}
