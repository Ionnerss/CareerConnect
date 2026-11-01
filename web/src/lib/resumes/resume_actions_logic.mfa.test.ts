import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
    requireMfaForAction: vi.fn(),
}));

vi.mock("@/lib/auth/require-mfa", () => ({
    requireMfaForAction: mocks.requireMfaForAction,
}));

import {
    archiveResume,
    unarchiveResume,
    downloadResume,
    viewResume,
    renameResume,
    replaceResume,
    deleteResume,
} from "./resume_actions_logic";

const resumeId = "test-resume-id";
const userId = "test-user-id";

describe("Resume Server Action MFA enforcement", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Simulate an MFA-enabled user who has
        // authenticated with a password but has
        // NOT completed the TOTP challenge.
        mocks.requireMfaForAction.mockRejectedValue(
            new Error(
                "Complete two-factor authentication to continue."
            )
        );
    });

    const protectedActions: Array<
        [string, () => Promise<unknown>]
    > = [
        [
            "archiveResume",
            () => archiveResume(resumeId),
        ],
        [
            "unarchiveResume",
            () => unarchiveResume(resumeId),
        ],
        [
            "downloadResume",
            () => downloadResume(resumeId),
        ],
        [
            "viewResume",
            () => viewResume(resumeId),
        ],
        [
            "renameResume",
            () => renameResume(resumeId, "New Name"),
        ],
        [
            "replaceResume",
            () => replaceResume(resumeId, new FormData()),
        ],
        [
            "deleteResume",
            () => deleteResume(resumeId),
        ],
    ];

    it.each(protectedActions)(
        "%s rejects an incomplete MFA session",
        async (_name, invoke) => {
            await expect(invoke()).rejects.toThrow(
                "Complete two-factor authentication to continue."
            );

            expect(
                mocks.requireMfaForAction
            ).toHaveBeenCalledOnce();
        }
    );

    it("does not access the database when MFA fails", async () => {
        // A rejected guard must prevent any
        // downstream database access.
        mocks.requireMfaForAction.mockRejectedValue(
            new Error("MFA required")
        );

        await expect(
            renameResume(resumeId, "Updated Name")
        ).rejects.toThrow("MFA required");
    });

    it("allows an authorized user to rename their resume", async () => {
        const query = {
            update: vi.fn(),
            eq: vi.fn(),
            select: vi.fn(),
            maybeSingle: vi.fn(),
        };

        // Mock Supabase's chained query builder.
        query.update.mockReturnValue(query);
        query.eq.mockReturnValue(query);
        query.select.mockReturnValue(query);

        query.maybeSingle.mockResolvedValue({
            data: { id: resumeId },
            error: null,
        });

        const supabase = {
            from: vi.fn().mockReturnValue(query),
        };

        // Simulate an authenticated session for
        // which MFA enforcement has succeeded.
        mocks.requireMfaForAction.mockResolvedValue({
            supabase,
            user: { id: userId },
        });

        await renameResume(resumeId, "My Resume");

        // Correct table.
        expect(supabase.from).toHaveBeenCalledWith(
            "resumes"
        );

        // Correct update.
        expect(query.update).toHaveBeenCalledWith({
            file_name: "My Resume.pdf",
        });

        // The update must target the requested resume.
        expect(query.eq).toHaveBeenCalledWith(
            "id",
            resumeId
        );

        // It must also be restricted to the owner.
        expect(query.eq).toHaveBeenCalledWith(
            "user_id",
            userId
        );

        // A database operation was performed only
        // after the MFA guard returned successfully.
        expect(
            mocks.requireMfaForAction
        ).toHaveBeenCalledOnce();
    });

    it("rejects an MFA verification service failure", async () => {
        mocks.requireMfaForAction.mockRejectedValue(
            new Error(
                "Unable to verify your authentication security level."
            )
        );

        await expect(
            deleteResume(resumeId)
        ).rejects.toThrow(
            "Unable to verify your authentication security level."
        );
    });
});
