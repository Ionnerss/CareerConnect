import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const { mockGet, mockSave } = vi.hoisted(() => ({ mockGet: vi.fn(), mockSave: vi.fn() }));

vi.mock("@/lib/recruiter/candidate-comparison-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/recruiter/candidate-comparison-service")>(
    "@/lib/recruiter/candidate-comparison-service",
  );
  return { ...actual, getJobRequirements: mockGet, saveJobRequirements: mockSave };
});

const JOB_ID = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ jobId: JOB_ID }) };
const url = `http://localhost/api/recruiter/jobs/${JOB_ID}/requirements`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/recruiter/jobs/[jobId]/requirements", () => {
  it("GET returns the saved requirements", async () => {
    mockGet.mockResolvedValueOnce({ success: true, requirements: [] });

    const response = await GET(new Request(url), context);

    expect(response.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith(JOB_ID);
  });

  it("GET maps a failure to its HTTP status", async () => {
    mockGet.mockResolvedValueOnce({ success: false, code: "FORBIDDEN", error: "x" });

    expect((await GET(new Request(url), context)).status).toBe(403);
  });

  it("PUT passes the requirements array to the service", async () => {
    mockSave.mockResolvedValueOnce({ success: true, requirements: [] });
    const requirements = [{ text: "React", kind: "core", weight: 8 }];

    const response = await PUT(new Request(url, { method: "PUT", body: JSON.stringify({ requirements }) }), context);

    expect(response.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith(JOB_ID, requirements);
  });

  it("PUT rejects a body that is not valid JSON", async () => {
    const response = await PUT(new Request(url, { method: "PUT", body: "{nope" }), context);

    expect(response.status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("PUT lets the service reject a body without requirements", async () => {
    mockSave.mockResolvedValueOnce({ success: false, code: "INVALID_INPUT", error: "Add at least one requirement." });

    const response = await PUT(new Request(url, { method: "PUT", body: JSON.stringify({}) }), context);

    expect(mockSave).toHaveBeenCalledWith(JOB_ID, undefined);
    expect(response.status).toBe(400);
  });
});
