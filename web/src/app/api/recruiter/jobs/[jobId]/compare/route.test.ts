import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockCompare } = vi.hoisted(() => ({ mockCompare: vi.fn() }));

vi.mock("@/lib/recruiter/candidate-comparison-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/recruiter/candidate-comparison-service")>(
    "@/lib/recruiter/candidate-comparison-service",
  );
  return { ...actual, compareJobCandidates: mockCompare };
});

const JOB_ID = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ jobId: JOB_ID }) };

function post(body?: string) {
  return POST(new Request(`http://localhost/api/recruiter/jobs/${JOB_ID}/compare`, { method: "POST", body }), context);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/recruiter/jobs/[jobId]/compare", () => {
  it("runs the comparison with default options when the body is empty", async () => {
    mockCompare.mockResolvedValueOnce({ success: true, ranked: [], failed: [] });

    const response = await post();

    expect(response.status).toBe(200);
    expect(mockCompare).toHaveBeenCalledWith(JOB_ID, {});
    expect(await response.json()).toMatchObject({ success: true });
  });

  it("passes the options from the JSON body", async () => {
    mockCompare.mockResolvedValueOnce({ success: true });

    await post(JSON.stringify({ limit: 5, refresh: true }));

    expect(mockCompare).toHaveBeenCalledWith(JOB_ID, { limit: 5, refresh: true });
  });

  it("rejects a body that is not valid JSON", async () => {
    const response = await post("{nope");

    expect(response.status).toBe(400);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["JOB_NOT_FOUND", 404],
    ["NO_REQUIREMENTS", 409],
    ["INVALID_INPUT", 400],
    ["AI_NOT_CONFIGURED", 503],
    ["BACKEND_ERROR", 500],
  ])("maps %s to HTTP %i", async (code, status) => {
    mockCompare.mockResolvedValueOnce({ success: false, code, error: "x" });

    expect((await post()).status).toBe(status);
  });
});
