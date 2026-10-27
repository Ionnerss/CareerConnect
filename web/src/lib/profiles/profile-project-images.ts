import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileProjectImageSchema } from "@/lib/validations/profile-project-image";

const BUCKET = "project-images";

const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

const imageFields =
    "id, project_id, storage_path, alt_text, created_at";

export async function uploadProjectImage(input: unknown) {
    const parsed = profileProjectImageSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Please choose a nonempty JPEG, PNG, or WebP image of 5 MiB or smaller.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { projectId, file, alt_text } = parsed.data;

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", projectId)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to load your project. Please try again.",
        };
    }

    if (!project) {
        return {
            success: false,
            code: "PROJECT_NOT_FOUND",
            error: "Project not found.",
        };
    }

    let validSignature: boolean;

    try {
        validSignature = await hasValidImageSignature(file);
    } catch {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Unable to read your image. Please choose another file.",
        };
    }

    if (!validSignature) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "The file contents do not match its image type.",
        };
    }

    const extension = extensions[file.type];

    // The schema restricts MIME types, but keep this guard in case it changes.
    if (!extension) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Unsupported image type.",
        };
    }

    const path =
        `${user.id}/${project.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to upload your project image. Please try again.",
        };
    }

    const { data: insertedImage, error: insertError } = await supabase
        .from("profile_project_images")
        .insert({
            project_id: project.id,
            storage_path: path,
            alt_text,
        })
        .select(imageFields)
        .maybeSingle();

    if (!insertError && insertedImage) {
        return {
            success: true,
            image: insertedImage,
        };
    }

    // The insert may have committed even if its response failed.
    const { data: savedImage, error: checkError } = await supabase
        .from("profile_project_images")
        .select(imageFields)
        .eq("project_id", project.id)
        .eq("storage_path", path)
        .maybeSingle();

    if (checkError) {
        // We cannot prove the insert failed. Removing the file might break
        // an image row that was actually saved.
        return {
            success: false,
            code: "OUTCOME_UNCERTAIN",
            error: "Could not confirm whether your image was saved. Refresh your project before trying again.",
        };
    }

    if (savedImage) {
        return {
            success: true,
            image: savedImage,
        };
    }

    // A successful read confirmed there is no image row for this path.
    const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove([path]);

    if (removeError) {
        console.error(
            "Failed to remove an unrecorded project image:",
            removeError,
        );

        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "The image could not be saved or cleaned up. Please try again later.",
        };
    }

    return {
        success: false,
        code: "BACKEND_ERROR",
        error: "Unable to save your project image. Please try again.",
    };
}

async function hasValidImageSignature(file: File): Promise<boolean> {
    const bytes = new Uint8Array(
        await file.slice(0, 12).arrayBuffer(),
    );

    if (file.type === "image/jpeg") {
        return (
            bytes.length >= 3 &&
            bytes[0] === 0xff &&
            bytes[1] === 0xd8 &&
            bytes[2] === 0xff
        );
    }

    if (file.type === "image/png") {
        const signature = [
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
        ];

        return (
            bytes.length >= signature.length &&
            signature.every(
                (expected, index) => bytes[index] === expected,
            )
        );
    }

    if (file.type === "image/webp") {
        const riff = [0x52, 0x49, 0x46, 0x46];
        const webp = [0x57, 0x45, 0x42, 0x50];

        return (
            bytes.length >= 12 &&
            riff.every(
                (expected, index) => bytes[index] === expected,
            ) &&
            webp.every(
                (expected, index) => bytes[index + 8] === expected,
            )
        );
    }

    return false;
}

export async function getCurrentProjectImages(projectId: string) {
    const parsedId = z.uuid().safeParse(projectId);

    if (!parsedId.success) {
        return {
            success: false,
            error: "Invalid project ID.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            error: "Unable to load your project. Please try again.",
        };
    }

    if (!project) {
        return {
            success: false,
            error: "Project not found.",
        };
    }

    const { data: images, error: imagesError } = await supabase
        .from("profile_project_images")
        .select(imageFields)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

    if (imagesError) {
        return {
            success: false,
            error: "Unable to load project images. Please try again.",
        };
    }

    return {
        success: true,
        images: images ?? [],
    };
}

export async function deleteProjectImage(imageId: string) {
    const parsedId = z.uuid().safeParse(imageId);

    if (!parsedId.success) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid project image ID.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: existingImage, error: imageError } = await supabase
        .from("profile_project_images")
        .select("id, project_id, storage_path")
        .eq("id", parsedId.data)
        .maybeSingle();

    if (imageError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to load your project image. Please try again.",
        };
    }

    if (!existingImage) {
        return {
            success: false,
            code: "IMAGE_NOT_FOUND",
            error: "Project image not found.",
        };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", existingImage.project_id)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to check project ownership. Please try again.",
        };
    }

    // A recruiter may be allowed to read the image row. Only its owner
    // may delete it.
    if (!project) {
        return {
            success: false,
            code: "IMAGE_NOT_FOUND",
            error: "Project image not found.",
        };
    }

    const { data: deletedImage, error: deleteError } = await supabase
        .from("profile_project_images")
        .delete()
        .eq("id", parsedId.data)
        .eq("project_id", project.id)
        .select("id")
        .maybeSingle();

    if (deleteError || !deletedImage) {
        // The delete might have committed despite a failed response.
        const { data: remainingImage, error: checkError } =
            await supabase
                .from("profile_project_images")
                .select("id")
                .eq("id", parsedId.data)
                .eq("project_id", project.id)
                .maybeSingle();

        if (checkError) {
            return {
                success: false,
                code: "OUTCOME_UNCERTAIN",
                error: "Could not confirm whether the image was deleted. Refresh your project before trying again.",
            };
        }

        if (remainingImage) {
            return {
                success: false,
                code: "BACKEND_ERROR",
                error: "Unable to delete your project image. Please try again.",
            };
        }

        // A successful read found no row: deletion is confirmed.
    }

    const expectedFolder = `${user.id}/${project.id}/`;

    // Defense in depth: never remove a file outside this user's project
    // folder, even if a bad path somehow entered the database.
    if (!existingImage.storage_path.startsWith(expectedFolder)) {
        console.error(
            "Deleted project image row had an unexpected Storage path:",
            existingImage.storage_path,
        );

        return {
            success: true,
            imageId: parsedId.data,
            cleanupPending: true,
        };
    }

    const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove([existingImage.storage_path]);

    if (removeError) {
        console.error(
            "Failed to remove deleted project image from Storage:",
            removeError,
        );

        return {
            success: true,
            imageId: parsedId.data,
            cleanupPending: true,
        };
    }

    return {
        success: true,
        imageId: parsedId.data,
        cleanupPending: false,
    };
}

export async function getProjectImageUrl(imageId: string) {
    const parsedId = z.uuid().safeParse(imageId);

    if (!parsedId.success) {
        return {
            success: false,
            code: "INVALID_INPUT",
            error: "Invalid project image ID.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            code: "UNAUTHENTICATED",
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    // RLS determines whether this user can see the image row.
    const { data: image, error: imageError } = await supabase
        .from("profile_project_images")
        .select("id, storage_path, alt_text")
        .eq("id", parsedId.data)
        .maybeSingle();

    if (imageError) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to load the project image. Please try again.",
        };
    }

    if (!image) {
        return {
            success: false,
            code: "IMAGE_NOT_FOUND",
            error: "Project image not found.",
        };
    }

    const expiresIn = 60;

    const { data, error: signingError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(image.storage_path, expiresIn);

    if (signingError || !data?.signedUrl) {
        return {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to open the project image. Please try again.",
        };
    }

    return {
        success: true,
        imageId: image.id,
        alt_text: image.alt_text,
        url: data.signedUrl,
        expiresIn,
    };
}