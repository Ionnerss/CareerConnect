import {
    deleteProjectImage,
    uploadProjectImage,
} from "@/lib/profiles/profile-project-images";

const failureStatuses: Record<string, number> = {
    INVALID_INPUT: 400,
    UNAUTHENTICATED: 401,
    PROJECT_NOT_FOUND: 404,
    IMAGE_NOT_FOUND: 404,
    OUTCOME_UNCERTAIN: 503,
    BACKEND_ERROR: 500,
};

function serviceResponse(result: {
    success: boolean;
    code?: string;
    [key: string]: unknown;
}) {
    const status = result.success
        ? 200
        : failureStatuses[result.code ?? ""] ?? 500;

    return Response.json(result, { status });
}

function invalidRequest(message: string) {
    return Response.json(
        {
            success: false,
            code: "INVALID_INPUT",
            error: message,
        },
        { status: 400 },
    );
}

function unexpectedError(operation: string, error: unknown) {
    console.error(`Project image ${operation} failed:`, error);

    return Response.json(
        {
            success: false,
            code: "BACKEND_ERROR",
            error: "Unable to process your project image. Please try again.",
        },
        { status: 500 },
    );
}

export async function POST(request: Request) {
    let formData: FormData;

    try {
        formData = await request.formData();
    } catch {
        return invalidRequest("Invalid image upload request.");
    }

    try {
        const result = await uploadProjectImage({
            projectId: formData.get("projectId"),
            file: formData.get("file"),
            alt_text: formData.get("alt_text"),
        });

        return serviceResponse(result);
    } catch (error) {
        return unexpectedError("upload", error);
    }
}

export async function DELETE(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return invalidRequest("Invalid image deletion request.");
    }

    if (
        typeof body !== "object" ||
        body === null ||
        !("imageId" in body) ||
        typeof body.imageId !== "string"
    ) {
        return invalidRequest("Provide an image ID.");
    }

    try {
        const result = await deleteProjectImage(body.imageId);
        return serviceResponse(result);
    } catch (error) {
        return unexpectedError("deletion", error);
    }
}