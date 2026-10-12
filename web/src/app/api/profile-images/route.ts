import { uploadProfileImage, type ProfileImageErrorCode } from "@/lib/profile-images";

const errorStatuses: Record<ProfileImageErrorCode, number> = {
    INVALID_INPUT: 400,
    UNAUTHENTICATED: 401,
    PROFILE_NOT_FOUND: 404,
    PROFILE_CONFLICT: 409,
    BACKEND_ERROR: 500,
    OUTCOME_UNCERTAIN: 503,
};

export async function POST(request: Request) {
    let formData: FormData;

    try {
        formData = await request.formData();
    } catch {
        return Response.json(
            {
                success: false,
                code: "INVALID_INPUT",
                error: "Invalid upload request.",
            },
            { status: 400 },
        );
    }

    const result = await uploadProfileImage({
        kind: formData.get("kind"),
        file: formData.get("file"),
    });

    if (result.success) {
        return Response.json(result, { status: 200 });
    }

    return Response.json(result, {
        status: errorStatuses[result.code],
    });
}