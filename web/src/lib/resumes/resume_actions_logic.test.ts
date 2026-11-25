
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireMfaForAction } from "@/lib/auth/require-mfa";
import {
    archiveResume,
    unarchiveResume,
    downloadResume,
    viewResume,
    renameResume,
    replaceResume,
    deleteResume,
} from "./resume_actions_logic";

vi.mock("@/lib/auth/require-mfa", () => ({
    requireMfaForAction: vi.fn(),
}));

const mockUser = { id: "user-123" };

type MockError = Error | null;

type DatabaseResult = {
    data: Record<string, string> | null;
    error: MockError;
};

type StorageResults = {
    signedUrl?: {
        data: { signedUrl: string } | null;
        error: MockError;
    };
    upload?: { error: MockError };
    remove?: { error: MockError };
};

type QueryBuilder = {
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
        resolve?: ((value: DatabaseResult) => unknown) | null,
        reject?: ((reason: unknown) => unknown) | null
    ) => Promise<unknown>;
};

const createQueryBuilder = (result: DatabaseResult) => {
    const builder = {} as QueryBuilder;

    builder.update = vi.fn(() => builder);
    builder.delete = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.is = vi.fn(() => builder);
    builder.not = vi.fn(() => builder);

    builder.single = vi.fn().mockResolvedValue(result);
    builder.maybeSingle = vi.fn().mockResolvedValue(result);

    builder.then = (resolve, reject) =>
        Promise.resolve(result).then(resolve ?? undefined, reject ?? undefined);

    return builder;
};

const createSupabaseMock = (
    databaseResults: DatabaseResult[] = [],
    storageResults: StorageResults = {}
) => {
    const queryBuilders: QueryBuilder[] = [];

    const storageBucket = {
        createSignedUrl: vi.fn().mockResolvedValue(
            storageResults.signedUrl ?? {
                data: { signedUrl: "https://example.com/resume.pdf" },
                error: null,
            }
        ),
        upload: vi.fn().mockResolvedValue(
            storageResults.upload ?? { error: null }
        ),
        remove: vi.fn().mockResolvedValue(
            storageResults.remove ?? { error: null }
        ),
    };

    const supabase = {
        from: vi.fn(() => {
            const result = databaseResults.shift() ?? {
                data: null,
                error: null,
            };

            const builder = createQueryBuilder(result);
            queryBuilders.push(builder);

            return builder;
        }),
        storage: {
            from: vi.fn(() => storageBucket),
        },
    };

    return { supabase, queryBuilders, storageBucket };
};

const setupMfa = (
    supabase: ReturnType<typeof createSupabaseMock>["supabase"]
) => {
    vi.mocked(requireMfaForAction).mockResolvedValue({
        supabase,
        user: mockUser,
    } as never);
};

const createFormData = (file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    return formData;
};

const createPdf = (
    name = "resume.pdf",
    size = 100,
    type = "application/pdf"
) => new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
    vi.clearAllMocks();
});

// --------------------------------------------------
// archiveResume
// --------------------------------------------------

describe("archiveResume", () => {
    it("archives a resume successfully", async () => {
        const { supabase, queryBuilders } = createSupabaseMock([
            { data: { id: "resume-1" }, error: null },
        ]);
        setupMfa(supabase);

        await expect(archiveResume("resume-1")).resolves.toBeUndefined();

        const query = queryBuilders[0];

        expect(supabase.from).toHaveBeenCalledWith("resumes");
        expect(query.update).toHaveBeenCalledWith(
            expect.objectContaining({
                archived_at: expect.any(String),
            })
        );
        expect(query.eq).toHaveBeenCalledWith("id", "resume-1");
        expect(query.eq).toHaveBeenCalledWith("user_id", mockUser.id);
        expect(query.is).toHaveBeenCalledWith("archived_at", null);
        expect(query.select).toHaveBeenCalledWith("id");
    });

    it("throws when the resume does not exist or is already archived", async () => {
        const { supabase } = createSupabaseMock([
            { data: null, error: null },
        ]);
        setupMfa(supabase);

        await expect(archiveResume("resume-1")).rejects.toThrow(
            "Resume not found or already archived."
        );
    });

    it("throws when the database update fails", async () => {
        const databaseError = new Error("Database update failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(archiveResume("resume-1")).rejects.toThrow(databaseError);
    });

    it("propagates MFA authorization errors", async () => {
        vi.mocked(requireMfaForAction).mockRejectedValue(
            new Error("MFA required")
        );

        await expect(archiveResume("resume-1")).rejects.toThrow("MFA required");
    });
});

// --------------------------------------------------
// unarchiveResume
// --------------------------------------------------

describe("unarchiveResume", () => {
    it("unarchives a resume successfully", async () => {
        const { supabase, queryBuilders } = createSupabaseMock([
            { data: { id: "resume-1" }, error: null },
        ]);
        setupMfa(supabase);

        await expect(unarchiveResume("resume-1")).resolves.toBeUndefined();

        const query = queryBuilders[0];

        expect(query.update).toHaveBeenCalledWith({ archived_at: null });
        expect(query.eq).toHaveBeenCalledWith("id", "resume-1");
        expect(query.eq).toHaveBeenCalledWith("user_id", mockUser.id);
        expect(query.not).toHaveBeenCalledWith("archived_at", "is", null);
    });

    it("throws when the resume does not exist or is not archived", async () => {
        const { supabase } = createSupabaseMock([
            { data: null, error: null },
        ]);
        setupMfa(supabase);

        await expect(unarchiveResume("resume-1")).rejects.toThrow(
            "Resume not found or not archived."
        );
    });

    it("throws when the database update fails", async () => {
        const databaseError = new Error("Database update failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(unarchiveResume("resume-1")).rejects.toThrow(databaseError);
    });
});

// --------------------------------------------------
// downloadResume
// --------------------------------------------------

describe("downloadResume", () => {
    it("returns a signed download URL", async () => {
        const { supabase, storageBucket } = createSupabaseMock([
            {
                data: {
                    file_path: "user-123/resume.pdf",
                    file_name: "My Resume.pdf",
                },
                error: null,
            },
        ]);
        setupMfa(supabase);

        const result = await downloadResume("resume-1");

        expect(result).toBe("https://example.com/resume.pdf");
        expect(supabase.storage.from).toHaveBeenCalledWith("resumes");
        expect(storageBucket.createSignedUrl).toHaveBeenCalledWith(
            "user-123/resume.pdf",
            60,
            { download: "My Resume.pdf" }
        );
    });

    it("throws when the resume lookup fails", async () => {
        const databaseError = new Error("Resume lookup failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(downloadResume("resume-1")).rejects.toThrow(databaseError);
    });

    it("throws when signed URL generation fails", async () => {
        const storageError = new Error("Signed URL failed");
        const { supabase } = createSupabaseMock(
            [
                {
                    data: {
                        file_path: "user-123/resume.pdf",
                        file_name: "My Resume.pdf",
                    },
                    error: null,
                },
            ],
            {
                signedUrl: { data: null, error: storageError },
            }
        );
        setupMfa(supabase);

        await expect(downloadResume("resume-1")).rejects.toThrow(storageError);
    });
});

// --------------------------------------------------
// viewResume
// --------------------------------------------------

describe("viewResume", () => {
    it("returns a signed viewing URL", async () => {
        const { supabase, storageBucket } = createSupabaseMock([
            {
                data: { file_path: "user-123/resume.pdf" },
                error: null,
            },
        ]);
        setupMfa(supabase);

        const result = await viewResume("resume-1");

        expect(result).toBe("https://example.com/resume.pdf");
        expect(supabase.storage.from).toHaveBeenCalledWith("resumes");
        expect(storageBucket.createSignedUrl).toHaveBeenCalledWith(
            "user-123/resume.pdf",
            60
        );
    });

    it("throws when the resume lookup fails", async () => {
        const databaseError = new Error("Resume lookup failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(viewResume("resume-1")).rejects.toThrow(databaseError);
    });

    it("throws when signed URL generation fails", async () => {
        const storageError = new Error("Signed URL failed");
        const { supabase } = createSupabaseMock(
            [
                {
                    data: { file_path: "user-123/resume.pdf" },
                    error: null,
                },
            ],
            {
                signedUrl: { data: null, error: storageError },
            }
        );
        setupMfa(supabase);

        await expect(viewResume("resume-1")).rejects.toThrow(storageError);
    });
});

// --------------------------------------------------
// renameResume
// --------------------------------------------------

describe("renameResume", () => {
    it.each([
        ["renames a resume successfully", "New Resume", "New Resume.pdf"],
        ["trims surrounding whitespace", "  My Resume  ", "My Resume.pdf"],
        ["does not append another PDF extension", "My Resume.PDF", "My Resume.pdf"],
    ])("%s", async (_description, input, expectedFileName) => {
        const { supabase, queryBuilders } = createSupabaseMock([
            { data: { id: "resume-1" }, error: null },
        ]);
        setupMfa(supabase);

        await renameResume("resume-1", input);

        expect(queryBuilders[0].update).toHaveBeenCalledWith({
            file_name: expectedFileName,
        });
    });

    it("rejects an empty filename", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        await expect(renameResume("resume-1", "")).rejects.toThrow(
            "Enter a filename between 1 and 100 characters."
        );
    });

    it("rejects a filename containing only whitespace", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        await expect(renameResume("resume-1", "   ")).rejects.toThrow(
            "Enter a filename between 1 and 100 characters."
        );
    });

    it("accepts a filename of exactly 100 characters", async () => {
        const { supabase, queryBuilders } = createSupabaseMock([
            { data: { id: "resume-1" }, error: null },
        ]);
        setupMfa(supabase);

        const name = "a".repeat(100);
        await renameResume("resume-1", name);

        expect(queryBuilders[0].update).toHaveBeenCalledWith({
            file_name: `${name}.pdf`,
        });
    });

    it("rejects a filename longer than 100 characters", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        await expect(renameResume("resume-1", "a".repeat(101))).rejects.toThrow(
            "Enter a filename between 1 and 100 characters."
        );
    });

    it("throws when the resume does not exist", async () => {
        const { supabase } = createSupabaseMock([
            { data: null, error: null },
        ]);
        setupMfa(supabase);

        await expect(renameResume("resume-1", "New Resume")).rejects.toThrow(
            "Resume not found."
        );
    });

    it("throws when the database update fails", async () => {
        const databaseError = new Error("Rename failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(renameResume("resume-1", "New Resume")).rejects.toThrow(
            databaseError
        );
    });
});

// --------------------------------------------------
// replaceResume
// --------------------------------------------------

describe("replaceResume", () => {
    const existingResume = {
        data: { file_path: "user-123/resume.pdf" },
        error: null,
    };

    it("replaces a resume successfully", async () => {
        const { supabase, queryBuilders, storageBucket } = createSupabaseMock([
            existingResume,
            { data: null, error: null },
        ]);
        setupMfa(supabase);

        const formData = createFormData(createPdf("updated.pdf"));

        await expect(replaceResume("resume-1", formData)).resolves.toBeUndefined();

        expect(supabase.storage.from).toHaveBeenCalledWith("resumes");
        expect(storageBucket.upload).toHaveBeenCalledWith(
            "user-123/resume.pdf",
            expect.any(File),
            { upsert: true, contentType: "application/pdf" }
        );

        expect(queryBuilders[1].update).toHaveBeenCalledWith(
            expect.objectContaining({
                file_name: "updated.pdf",
                uploaded_at: expect.any(String),
            })
        );
    });

    it("rejects when no file is provided", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        await expect(replaceResume("resume-1", new FormData())).rejects.toThrow(
            "Select a PDF file."
        );
    });

    it("rejects an empty file", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        const formData = createFormData(createPdf("empty.pdf", 0));

        await expect(replaceResume("resume-1", formData)).rejects.toThrow(
            "Select a PDF file."
        );
    });

    it("rejects an invalid MIME type", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        const file = createPdf("resume.pdf", 100, "text/plain");

        await expect(replaceResume("resume-1", createFormData(file))).rejects.toThrow(
            "Only PDF files are allowed."
        );
    });

    it("rejects a filename without a PDF extension", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        const file = createPdf("resume.txt");

        await expect(replaceResume("resume-1", createFormData(file))).rejects.toThrow(
            "Only PDF files are allowed."
        );
    });

    it("accepts a PDF file of exactly 5 MB", async () => {
        const { supabase, queryBuilders } = createSupabaseMock([
            existingResume,
            { data: null, error: null },
        ]);
        setupMfa(supabase);

        const file = createPdf("resume.pdf", 5 * 1024 * 1024);

        await expect(
            replaceResume("resume-1", createFormData(file))
        ).resolves.toBeUndefined();

        expect(queryBuilders).toHaveLength(2);
    });

    it("rejects a PDF larger than 5 MB", async () => {
        const { supabase } = createSupabaseMock();
        setupMfa(supabase);

        const file = createPdf("resume.pdf", 5 * 1024 * 1024 + 1);

        await expect(replaceResume("resume-1", createFormData(file))).rejects.toThrow(
            "The PDF must be 5 MB or smaller."
        );
    });

    it("throws when the resume lookup fails", async () => {
        const databaseError = new Error("Resume lookup failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(
            replaceResume("resume-1", createFormData(createPdf()))
        ).rejects.toThrow(databaseError);
    });

    it("throws when storage upload fails", async () => {
        const storageError = new Error("Upload failed");
        const { supabase } = createSupabaseMock(
            [existingResume],
            { upload: { error: storageError } }
        );
        setupMfa(supabase);

        await expect(
            replaceResume("resume-1", createFormData(createPdf()))
        ).rejects.toThrow(storageError);
    });

    it("throws when updating resume metadata fails", async () => {
        const databaseError = new Error("Metadata update failed");
        const { supabase } = createSupabaseMock([
            existingResume,
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(
            replaceResume("resume-1", createFormData(createPdf()))
        ).rejects.toThrow(databaseError);
    });
});

// --------------------------------------------------
// deleteResume
// --------------------------------------------------

describe("deleteResume", () => {
    const existingResume = {
        data: { file_path: "user-123/resume.pdf" },
        error: null,
    };

    it("deletes the storage file and database record", async () => {
        const { supabase, queryBuilders, storageBucket } = createSupabaseMock([
            existingResume,
            { data: null, error: null },
        ]);
        setupMfa(supabase);

        await expect(deleteResume("resume-1")).resolves.toBeUndefined();

        expect(supabase.storage.from).toHaveBeenCalledWith("resumes");
        expect(storageBucket.remove).toHaveBeenCalledWith([
            "user-123/resume.pdf",
        ]);
        expect(queryBuilders[1].delete).toHaveBeenCalled();
        expect(queryBuilders[1].eq).toHaveBeenCalledWith("id", "resume-1");
        expect(queryBuilders[1].eq).toHaveBeenCalledWith("user_id", mockUser.id);
    });

    it("throws when the resume lookup fails", async () => {
        const databaseError = new Error("Resume lookup failed");
        const { supabase } = createSupabaseMock([
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(deleteResume("resume-1")).rejects.toThrow(databaseError);
    });

    it("throws when storage removal fails", async () => {
        const storageError = new Error("Storage removal failed");
        const { supabase } = createSupabaseMock(
            [existingResume],
            { remove: { error: storageError } }
        );
        setupMfa(supabase);

        await expect(deleteResume("resume-1")).rejects.toThrow(storageError);
    });

    it("throws when database deletion fails", async () => {
        const databaseError = new Error("Database deletion failed");
        const { supabase } = createSupabaseMock([
            existingResume,
            { data: null, error: databaseError },
        ]);
        setupMfa(supabase);

        await expect(deleteResume("resume-1")).rejects.toThrow(databaseError);
    });
});
