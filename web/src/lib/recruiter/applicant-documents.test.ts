import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApplicantDocumentUrl } from "./applicant-documents";

vi.mock("server-only", () => ({}));

const {
  mockGetUser,
  mockFrom,
  mockStorageFrom,
  mockSignedUrl,
  results,
  calls,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockSignedUrl: vi.fn(),
  results: {} as Record<
    string,
    Array<{ data: unknown; error: unknown }>
  >,
  calls: [] as Array<{
    table: string;
    method: string;
    args: unknown[];
  }>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })),
}));

const RECRUITER =
  "11111111-1111-4111-8111-111111111111";
const APPLICANT =
  "22222222-2222-4222-8222-222222222222";
const APPLICATION =
  "33333333-3333-4333-8333-333333333333";
const JOB =
  "44444444-4444-4444-8444-444444444444";
const RESUME =
  "55555555-5555-4555-8555-555555555555";

const application = {
  id: APPLICATION,
  job_id: JOB,
  applicant_id: APPLICANT,
  resume_id: RESUME,
  cover_letter_path:
    `${APPLICANT}/${APPLICATION}/cover-letter.pdf`,
};

function queue(table: string, data: unknown) {
  (results[table] ??= []).push({
    data,
    error: null,
  });
}

function query(table: string) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => {
      return results[table]?.shift() ?? {
        data: null,
        error: null,
      };
    }),
  };

  builder.select.mockImplementation((...args: unknown[]) => {
    calls.push({ table, method: "select", args });
    return builder;
  });

  builder.eq.mockImplementation((...args: unknown[]) => {
    calls.push({ table, method: "eq", args });
    return builder;
  });

  return builder;
}

function signedInAsRecruiter() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: RECRUITER } },
    error: null,
  });

  queue("profiles", { role: "recruiter" });
}

function allowOwnedApplication() {
  queue("applications", application);
  queue("job", { id: JOB });
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;

  for (const key of Object.keys(results)) {
    delete results[key];
  }

  mockFrom.mockImplementation((table: string) => query(table));

  mockStorageFrom.mockReturnValue({
    createSignedUrl: mockSignedUrl,
  });

  mockSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://example.com/signed-pdf" },
    error: null,
  });
});

describe("getApplicantDocumentUrl", () => {
  it("rejects invalid input without database access", async () => {
    const result = await getApplicantDocumentUrl({
      applicationId: "invalid",
      kind: "resume",
      mode: "view",
    });

    expect(result.success).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects extra fields in a document request", async () => {
    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
      filePath: "another-user/private.pdf",
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid document request.",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("blocks signed-out users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result.success).toBe(false);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("blocks users without recruiter role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: APPLICANT } },
      error: null,
    });

    queue("profiles", { role: "job_seeker" });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result.success).toBe(false);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("blocks recruiters who do not own the posting", async () => {
    signedInAsRecruiter();

    queue("applications", application);
    queue("job", null);

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result.success).toBe(false);

    expect(calls).toContainEqual({
      table: "job",
      method: "eq",
      args: ["recruiter_id", RECRUITER],
    });

    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("rejects an application that does not exist", async () => {
    signedInAsRecruiter();

    queue("applications", null);

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result).toEqual({
      success: false,
      error: "You cannot access this document.",
    });

    expect(mockFrom).not.toHaveBeenCalledWith("job");
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("creates a view URL for an authorized resume", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", {
      file_path: `${APPLICANT}/${RESUME}.pdf`,
      file_name: "my-resume.pdf",
    });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result).toEqual({
      success: true,
      url: "https://example.com/signed-pdf",
    });

    expect(mockStorageFrom).toHaveBeenCalledWith(
      "resumes"
    );

    expect(mockSignedUrl).toHaveBeenCalledWith(
      `${APPLICANT}/${RESUME}.pdf`,
      60,
      undefined
    );
  });

  it("sets a download filename for a resume", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", {
      file_path: `${APPLICANT}/${RESUME}.pdf`,
      file_name: "my-resume.pdf",
    });

    await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "download",
    });

    expect(mockSignedUrl).toHaveBeenCalledWith(
      `${APPLICANT}/${RESUME}.pdf`,
      60,
      { download: "my-resume.pdf" }
    );
  });

  it("rejects a missing resume record", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", null);

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result).toEqual({
      success: false,
      error: "This document is not available.",
    });

    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("queries the resume using its applicant ownership", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", {
      file_path: `${APPLICANT}/${RESUME}.pdf`,
      file_name: "resume.pdf",
    });

    await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(calls).toContainEqual({
      table: "resumes",
      method: "eq",
      args: ["id", RESUME],
    });

    expect(calls).toContainEqual({
      table: "resumes",
      method: "eq",
      args: ["user_id", APPLICANT],
    });
  });

  it("refuses a resume that does not belong to the applicant", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", {
      file_path: `${RECRUITER}/someone-elses-resume.pdf`,
      file_name: "private.pdf",
    });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result.success).toBe(false);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("returns unavailable for a missing cover letter", async () => {
    signedInAsRecruiter();

    queue("applications", {
      ...application,
      cover_letter_path: null,
    });

    queue("job", { id: JOB });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "cover_letter",
      mode: "view",
    });

    expect(result.success).toBe(false);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("creates a signed URL for an authorized cover letter", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "cover_letter",
      mode: "download",
    });

    expect(result.success).toBe(true);

    expect(mockStorageFrom).toHaveBeenCalledWith(
      "cover_letters"
    );

    expect(mockSignedUrl).toHaveBeenCalledWith(
      application.cover_letter_path,
      60,
      { download: "cover-letter.pdf" }
    );
  });

  it("rejects a cover letter path outside its application folder", async () => {
    signedInAsRecruiter();

    queue("applications", {
      ...application,
      cover_letter_path: `${APPLICANT}/other-application/file.pdf`,
    });

    queue("job", { id: JOB });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "cover_letter",
      mode: "view",
    });

    expect(result.success).toBe(false);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("returns an error when signing fails", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", {
      file_path: `${APPLICANT}/${RESUME}.pdf`,
      file_name: "resume.pdf",
    });

    mockSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Storage denied" },
    });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result.success).toBe(false);
  });

  it("returns an error when signed URL data is missing", async () => {
    signedInAsRecruiter();
    allowOwnedApplication();

    queue("resumes", {
      file_path: `${APPLICANT}/${RESUME}.pdf`,
      file_name: "resume.pdf",
    });

    mockSignedUrl.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await getApplicantDocumentUrl({
      applicationId: APPLICATION,
      kind: "resume",
      mode: "view",
    });

    expect(result).toEqual({
      success: false,
      error: "Unable to open this document. Please try again.",
    });
  });
});
