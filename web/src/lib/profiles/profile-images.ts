import { createClient } from "@/lib/supabase/server";
import { profileImageSchema, removeProfileImageSchema } from "../validations/profile-image";

export type ProfileImageErrorCode =
    | "INVALID_INPUT"
    | "UNAUTHENTICATED"
    | "PROFILE_NOT_FOUND"
    | "PROFILE_CONFLICT"
    | "BACKEND_ERROR"
    | "OUTCOME_UNCERTAIN";

type ImageProfile = {
    id: string;
    avatar_path: string | null;
    background_path: string | null;
};

export type ProfileImageResult =
    | {
          success: true;
          profile: ImageProfile;
      }
    | {
          success: false;
          code: ProfileImageErrorCode;
          error: string;
      };

export async function uploadProfileImage(
    input: unknown,
): Promise<ProfileImageResult> {
    const parsed = profileImageSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Please choose a nonempty JPEG, PNG, or WebP image of 5 MiB or smaller.",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { file, kind } = parsed.data;

    let valid: boolean;

    try {
        valid = await validateImage(file);
    } catch {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Unable to read your image. Please try a different image.",
        };
    }

    if (!valid) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid image. Please try a different image.",
        };
    }

    let extension: string;

    if (file.type === "image/jpeg") {
        extension = "jpg";
    } else if (file.type === "image/png") {
        extension = "png";
    } else if (file.type === "image/webp") {
        extension = "webp";
    } else {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Please choose a JPEG, PNG, or WebP image.",
        };
    }

    const column =
        kind === "avatar" ? "avatar_path" : "background_path";

    const { data: existingProfile, error: existingProfileError } =
        await supabase
            .from("profiles")
            .select("avatar_path, background_path")
            .eq("id", user.id)
            .maybeSingle();

    if (existingProfileError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Could not load your profile. Please try again.",
        };
    }

    if (!existingProfile) {
        return {
            success: false,
            code: "PROFILE_NOT_FOUND",
            error: "Profile not found.",
        };
    }

    const oldPath = existingProfile[column];
    const path = `${user.id}/${kind}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(path, file, {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to upload your image. Please try again.",
        };
    }

    let updateQuery = supabase
        .from("profiles")
        .update({ [column]: path })
        .eq("id", user.id);

    // Update only if this image has not changed since the initial read.
    if (oldPath === null) {
        updateQuery = updateQuery.is(column, null);
    } else {
        updateQuery = updateQuery.eq(column, oldPath);
    }

    const { data: profile, error: profileError } = await updateQuery
        .select("id, avatar_path, background_path")
        .maybeSingle();

    let savedProfile: ImageProfile;

    if (!profileError && profile) {
        savedProfile = profile;
    } else {
        const { data: currentProfile, error: checkError } = await supabase
            .from("profiles")
            .select("id, avatar_path, background_path")
            .eq("id", user.id)
            .maybeSingle();

        if (checkError) {
            // The update may have succeeded. Keep the uploaded file.
            return {
                success: false,
                code: "OUTCOME_UNCERTAIN",
                error: "Could not confirm whether your image was saved. Please refresh your profile.",
            };
        }

        if (currentProfile && currentProfile[column] === path) {
            savedProfile = currentProfile;
        } else {
            // The new file is not the profile's current image.
            const { error: removeError } = await supabase.storage
                .from("profile-images")
                .remove([path]);

            if (removeError) {
                console.error(
                    "Failed to remove unused profile image:",
                    removeError,
                );

                return {
                    success: false,
                    code: "BACKEND_ERROR",
                    error: "Your image could not be saved or cleaned up. Please try again later.",
                };
            }

            if (!currentProfile) {
                return {
                    success: false,
                    code: "PROFILE_NOT_FOUND",
                    error: "Profile not found.",
                };
            }

            if (currentProfile[column] !== oldPath) {
                return {
                    success: false,
                    code: "PROFILE_CONFLICT",
                    error: "Your profile image changed during this upload. Please refresh your profile before trying again.",
                };
            }

            return {
                success: false,
                code: "BACKEND_ERROR",
                error: "Your image could not be saved. Please refresh your profile before trying again.",
            };
        }
    }

    // Only remove an old image from this user's matching image folder.
    if (
        typeof oldPath === "string" &&
        oldPath !== path &&
        oldPath.startsWith(`${user.id}/${kind}/`)
    ) {
        const { error: cleanupError } = await supabase.storage
            .from("profile-images")
            .remove([oldPath]);

        if (cleanupError) {
            console.error(
                "Failed to remove previous profile image:",
                cleanupError,
            );
        }
    }

    return {
        success: true,
        profile: savedProfile,
    };
}

export async function removeProfileImage(
    input: unknown,
): Promise<ProfileImageResult> {
    const parsed = removeProfileImageSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Please choose avatar or background.",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { kind } = parsed.data;
    const column =
        kind === "avatar" ? "avatar_path" : "background_path";

    const { data: existingProfile, error: readError } = await supabase
        .from("profiles")
        .select("id, avatar_path, background_path")
        .eq("id", user.id)
        .maybeSingle();

    if (readError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Could not load your profile. Please try again.",
        };
    }

    if (!existingProfile) {
        return {
            success: false,
            code: "PROFILE_NOT_FOUND",
            error: "Profile not found.",
        };
    }

    const oldPath = existingProfile[column];

    // Removing an already-empty image is successful.
    if (oldPath === null) {
        return {
            success: true,
            profile: existingProfile,
        };
    }

    // Clear only the image we read. Do not clear a newer upload.
    const { data: profile, error: updateError } = await supabase
        .from("profiles")
        .update({ [column]: null })
        .eq("id", user.id)
        .eq(column, oldPath)
        .select("id, avatar_path, background_path")
        .maybeSingle();

    let savedProfile: ImageProfile;

    if (!updateError && profile && profile[column] === null) {
        savedProfile = profile;
    } else {
        // The update may have succeeded even if its response failed.
        const { data: currentProfile, error: checkError } = await supabase
            .from("profiles")
            .select("id, avatar_path, background_path")
            .eq("id", user.id)
            .maybeSingle();

        if (checkError) {
            // Keep the file because the profile may still reference it.
            return {
                success: false,
                code: "OUTCOME_UNCERTAIN",
                error: "Could not confirm whether your image was removed. Please refresh your profile.",
            };
        }

        if (!currentProfile) {
            return {
                success: false,
                code: "PROFILE_NOT_FOUND",
                error: "Profile not found.",
            };
        }

        if (currentProfile[column] === null) {
            savedProfile = currentProfile;
        } else if (currentProfile[column] !== oldPath) {
            // Another operation changed the image. Leave its files alone.
            return {
                success: false,
                code: "PROFILE_CONFLICT",
                error: "Your profile image changed during removal. Please refresh your profile before trying again.",
            };
        } else {
            // The profile still references the old file. Do not delete it.
            return {
                success: false,
                code: "BACKEND_ERROR",
                error: "Unable to remove your profile image. Please try again.",
            };
        }
    }

    // The database reference is confirmed cleared.
    // Only clean up a file in this user's matching image folder.
    if (
        typeof oldPath === "string" &&
        oldPath.startsWith(`${user.id}/${kind}/`)
    ) {
        try {
            const { error: cleanupError } = await supabase.storage
                .from("profile-images")
                .remove([oldPath]);

            if (cleanupError) {
                console.error(
                    "Profile image cleared, but file cleanup failed:",
                    cleanupError,
                );
            }
        } catch (cleanupError) {
            console.error(
                "Profile image cleared, but file cleanup threw:",
                cleanupError,
            );
        }
    }

    // Cleanup failure does not undo the confirmed profile change.
    return {
        success: true,
        profile: savedProfile,
    };
}

async function validateImage(file: File): Promise<boolean> {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

    if (file.type === "image/jpeg") {
        return (
            bytes.length >= 3 &&
            bytes[0] === 0xff &&
            bytes[1] === 0xd8 &&
            bytes[2] === 0xff
        );
    }

    if (file.type === "image/png") {
        const expected = [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ];

        return (
            bytes.length >= expected.length &&
            expected.every((value, index) => value === bytes[index])
        );
    }

    if (file.type === "image/webp") {
        const riff = [82, 73, 70, 70];
        const webp = [87, 69, 66, 80];

        return (
            bytes.length >= 12 &&
            riff.every((value, index) => value === bytes[index]) &&
            webp.every((value, index) => value === bytes[index + 8])
        );
    }

    return false;
}