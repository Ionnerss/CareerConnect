import { describe, expect, it, vi, beforeEach } from "vitest";
import { getCurrentProfile, updateCurrentProfile } from "./profile";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: {
            getUser: mockGetUser
        },
        from: mockFrom
    }))
}));

describe("Mock Supabase Client", () => {
    beforeEach(() => {
        mockGetUser.mockReset();
        mockFrom.mockReset();
    });

    const validProfile = {
        full_name: "Test User",
        bio: `Software Engineering Student.`,
        location: "Montreal",
        contact_email: "test@example.com"
    };

    it("Authentication returns an error", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: null },
            error: { message: "Authentication failed."}
        });

        const result = await getCurrentProfile();

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again."
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("No authenticated user", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: null },
            error: null
        });

        const result = await getCurrentProfile();

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again."
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns a failure when the profile query fails", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: "Database query failed" }
        });

        const mockEq = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockSelect = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            select: mockSelect
        });

        const result = await getCurrentProfile();

        expect(result).toEqual({
            success: false,
            error: "Unable to load your profile. Please try again."
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });

    it("returns a failure when the profile is missing", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data: null,
            error: null
        });

        const mockEq = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockSelect = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            select: mockSelect
        });

        const result = await getCurrentProfile();

        expect(result).toEqual({
            success: false,
            error: "Profile not found."
        });
    });

    it("returns the authenticated user's profile", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const profile = {
            id: "test-user-id",
            full_name: "Test User",
            bio: "Software engineering student.",
            location: "Montreal",
            contact_email: "test@example.com"
        };

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data: profile,
            error: null
        });

        const mockEq = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockSelect = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            select: mockSelect
        });

        const result = await getCurrentProfile();

        expect(result).toEqual({
            success: true,
            profile
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });

    it("Invalid input", async () => {
        const profile = {
            ...validProfile,
            full_name: ""
        };

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: false,
            error: "Please check your profile details."
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("Authentication error", async () => {
        const profile = { ...validProfile };

        mockGetUser.mockResolvedValueOnce({
            data: { user: null },
            error: { message: "Authentification failed." }
        });

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again."
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("No authenticated user", async () => {
        const profile = { ...validProfile };

        mockGetUser.mockResolvedValueOnce({
            data: { user: null },
            error: null
        });

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: false,
            error: "Unable to authenticate. Please sign in again."
        });

        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("Update returns an error", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data:  null,
            error: { message: "Database update failed." }
        });
        
        const mockSelect = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockEq = vi.fn().mockReturnValue({
            select: mockSelect
        });

        const mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            update: mockUpdate
        });

        const profile = { ...validProfile };

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: false,
            error: "Unable to save your profile. Please try again."
        });

        expect(mockUpdate).toHaveBeenCalled();
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });

    it("Update returns no profile", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data:  null,
            error: null
        });
        
        const mockSelect = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockEq = vi.fn().mockReturnValue({
            select: mockSelect
        });

        const mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            update: mockUpdate
        });

        const profile = { ...validProfile };

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: false,
            error: "Profile not found."
        });
    });

    it("Update returns a profile", async () => {
        const updateProfile = {
            id: "test-user-id",
            ...validProfile
        }

        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data:  updateProfile,
            error: null
        });

        const mockSelect = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockEq = vi.fn().mockReturnValue({
            select: mockSelect
        });

        const mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            update: mockUpdate
        });

        const result = await updateCurrentProfile(validProfile);

        expect(result).toEqual({
            success: true,
            profile: updateProfile
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith({...validProfile});
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });

    it("Input contains surrounding spaces",  async () => {
        const profile = {
            full_name: " Test User ",
            bio: "  First paragraph.\n\nSecond paragraph.  ",
            location: " Montreal ",
            contact_email: " test@example.com "
        }

        const savedProfile = {
            id: "test-user-id",
            full_name: "Test User",
            bio: "  First paragraph.\n\nSecond paragraph.  ",
            location: "Montreal",
            contact_email: "test@example.com"
        };

        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data:  savedProfile,
            error: null
        });

        const mockSelect = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockEq = vi.fn().mockReturnValue({
            select: mockSelect
        });

        const mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            update: mockUpdate
        });

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: true,
            profile: savedProfile
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith({
            full_name: "Test User",
            bio: "  First paragraph.\n\nSecond paragraph.  ",
            location: "Montreal",
            contact_email:"test@example.com"
        });
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });

    it("input contains blank optional fields", async () => {
        const profile = {
            full_name: "Test User",
            bio: "          ",
            location: "",
            contact_email: "         "
        };

        const savedProfile = {
            id: "test-user-id",
            full_name: "Test User",
            bio: null,
            location: null,
            contact_email: null
        };

        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data:  savedProfile,
            error: null
        });

        const mockSelect = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockEq = vi.fn().mockReturnValue({
            select: mockSelect
        });

        const mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            update: mockUpdate
        });

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: true,
            profile: savedProfile
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith({
            full_name: "Test User",
            bio: null,
            location: null,
            contact_email:null
        });
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });

    it("Input includes another user id or a role", async () => {
        const profile = {
            id: "another-user-id",
            role: "admin",
            ...validProfile
        };

        const savedProfile = {
            id: "test-user-id",
            ...validProfile
        };

        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id" } },
            error: null
        });

        const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
            data:  savedProfile,
            error: null
        });

        const mockSelect = vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
        });

        const mockEq = vi.fn().mockReturnValue({
            select: mockSelect
        });

        const mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq
        });

        mockFrom.mockReturnValueOnce({
            update: mockUpdate
        });

        const result = await updateCurrentProfile(profile);

        expect(result).toEqual({
            success: true,
            profile: savedProfile
        });

        expect(mockFrom).toHaveBeenCalledWith("profiles");
        expect(mockUpdate).toHaveBeenCalledWith(validProfile);
        expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    });
});
