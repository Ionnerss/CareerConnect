import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMfaStatus } from "./mfa";

const {
    mockGetUser,
    mockGetMfaLevel
} = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockGetMfaLevel: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser, mfa: { getAuthenticatorAssuranceLevel: mockGetMfaLevel }}
    })),
}));


describe("MFA failing scenarios", () => {
    beforeEach(() => {
        mockGetUser.mockReset();
        mockGetMfaLevel.mockReset();
    });

    it("Unauthenticated", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: null},
            error: null
        });

        await expect(getMfaStatus()).rejects.toThrow("You must be logged in.");
        expect(mockGetMfaLevel).not.toHaveBeenCalled();
    });

    it("Authentication error", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: null },
            error: new Error("Session expired")
        });

        await expect(getMfaStatus()).rejects.toThrow("Session expired");
        expect(mockGetMfaLevel).not.toHaveBeenCalled();
    })

    it("MFA API error", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: null,
            error: new Error("MFA service unavailable")
        });

        await expect(getMfaStatus()).rejects.toThrow("MFA service unavailable");
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });

    it("Both levels are aal1", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: { currentLevel: 'aal1', nextLevel: 'aal1' },
            error: null
        });

        const result = await getMfaStatus();

        expect(result).toEqual({
            accessAllowed: true,
            status: "authenticated"
        });
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });

    it("current = aal1 and next = aal2", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: { currentLevel: 'aal1', nextLevel: 'aal2' },
            error: null
        });

        const result = await getMfaStatus();

        expect(result).toEqual({
            accessAllowed: false,
            status: "mfa_required"
        });
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });

    it("Both levels are aal2", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: { currentLevel: 'aal2', nextLevel: 'aal2' },
            error: null
        });

        const result = await getMfaStatus();

        expect(result).toEqual({
            accessAllowed: true,
            status: "authenticated"
        });
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });

    it("current = aal2 and next = aal1", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: { currentLevel: 'aal2', nextLevel: 'aal1' },
            error: null
        });

        const result = await getMfaStatus();

        expect(result).toEqual({
            accessAllowed: false,
            status: "session_stale"
        });
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });

    it("current = null and next = aal1", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: { currentLevel: null , nextLevel: 'aal1' },
            error: null
        });

        const result = await getMfaStatus();

        expect(result).toEqual({
            accessAllowed: false,
            status: "auth_info_unavailable"
        });
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });

    it("Both current and next are null", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: "test-user-id" },
            error: null
        });

        mockGetMfaLevel.mockResolvedValueOnce({
            data: { currentLevel: null , nextLevel: null },
            error: null
        });

        const result = await getMfaStatus();

        expect(result).toEqual({
            accessAllowed: false,
            status: "auth_info_unavailable"
        });
        expect(mockGetMfaLevel).toHaveBeenCalledOnce();
    });
});