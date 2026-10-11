import { createClient } from "@/lib/supabase/server";
import { profileImageSchema } from "./validations/profile-image";

export async function uploadProfileImage(input: unknown) {
    const parsed = profileImageSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
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
            error: "Unable to read your image. Please try a different image.",
        };
    }

    if (!valid) {
        return {
            success: false,
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
            error: "Could not load your profile. Please try again.",
        };
    }

    if (!existingProfile) {
        return {
            success: false,
            error: "Profile not found.",
        };
    }

    const oldPath = existingProfile[column];
    const uniqueFilename = `${crypto.randomUUID()}.${extension}`;
    const path = `${user.id}/${kind}/${uniqueFilename}`;

    const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(path, file, {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return {
            success: false,
            error: "Unable to upload your image. Please try again.",
        };
    }

    let updateQuery = supabase
        .from("profiles")
        .update({ [column]: path })
        .eq("id", user.id);

    if (oldPath === null) {
        updateQuery = updateQuery.is(column, null);
    } else {
        updateQuery = updateQuery.eq(column, oldPath);
    }

    const { data: profile, error: profileError } = await updateQuery
        .select("id, avatar_path, background_path")
        .maybeSingle();

    let savedProfile = profile;

    if (profileError || !profile) {
        const { data: currentProfile, error: checkError } = await supabase
            .from("profiles")
            .select("id, avatar_path, background_path")
            .eq("id", user.id)
            .maybeSingle();

        if (checkError) {
            return {
                success: false,
                error: "Could not confirm whether your image was saved. Please refresh your profile.",
            };
        }

        if (currentProfile && currentProfile[column] === path) {
            savedProfile = currentProfile;
        } else {
            const { error: removeError } = await supabase.storage
                .from("profile-images")
                .remove([path]);

            if (removeError) {
                console.error(
                    "Failed to remove unused profile image:",
                    removeError,
                );
            }

            return {
                success: false,
                error: "Your image could not be saved. Please refresh your profile before trying again.",
            };
        }
    }

    // Only clean up an old image from this user's matching image folder.
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

async function validateImage(file: File): Promise<boolean> {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

    if (file.type === 'image/jpeg') {
        if (bytes.length < 3) return false;
        return (bytes.at(0) === 0xFF && bytes.at(1) === 0xD8 && bytes.at(2) === 0xFF);
    }
    else if (file.type === 'image/png') {
        if (bytes.length < 8) return false;

        const expectedBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        return expectedBytes.every((expected, index) => expected === bytes[index]);
    }
    else if (file.type === 'image/webp') {
        if (bytes.length < 12) return false;

        const RIFF = [82, 73, 70, 70];
        const WEBP = [87, 69, 66, 80];

        return (
            RIFF.every((expected, index) => expected === bytes[index])
            && WEBP.every((expected, index) => expected === bytes[index + 8])
        );
    }
    else return false;
}