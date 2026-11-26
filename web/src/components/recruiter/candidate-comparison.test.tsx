// @vitest-environment jsdom

/**
 * Tests the recruiter comparison panel with a mocked fetch: what it sends
 * when saving and comparing, how results and the review flag are shown,
 * and that API errors reach the recruiter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultWeight } from "@/lib/recruiter/comparison-view";
import CandidateComparison from "./candidate-comparison";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const REQ = { id: "r1", text: "React experience", kind: "core" as const, weight: 8 };

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function compareBody() {
  return {
    success: true,
    job_id: JOB_ID,
    requirements: [REQ],
    ranked: [
      {
        application_id: "a1",
        full_name: "Ada Lovelace",
        score: 92,
        min_confidence: 0.9,
        needs_human_review: false,
        results: [{ requirement_id: "r1", score: 3, confidence: 0.9 }],
        cached: false,
      },
      {
        application_id: "a2",
        full_name: null,
        score: 40,
        min_confidence: 0.3,
        needs_human_review: true,
        results: [{ requirement_id: "r1", score: 1, confidence: 0.3 }],
        cached: true,
      },
    ],
    failed: [],
    total_applicants: 2,
    compared_count: 2,
    saved: true,
  };
}

type Requirements = Parameters<typeof CandidateComparison>[0]["initialRequirements"];

function renderPanel(requirements: Requirements = [REQ], applicantCount = 2) {
  return render(
    <CandidateComparison
      jobId={JOB_ID}
      initialRequirements={requirements}
      applicantCount={applicantCount}
    />,
  );
}

describe("CandidateComparison", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows saved requirements and the privacy notice", () => {
    renderPanel();
    expect((screen.getByLabelText("Requirement 1") as HTMLInputElement).value).toBe("React experience");
    expect(screen.getByText(/company names and school names are not sent/i)).toBeTruthy();
  });

  it("saves edited requirements with a PUT", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      jsonResponse({ success: true, job_id: JOB_ID, requirements: [REQ, { ...REQ, id: "r2", text: "SQL", kind: "nice", weight: 3 }] }),
    );
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Add nice-to-have" }));
    await user.type(screen.getByLabelText("Requirement 2"), "SQL");
    await user.click(screen.getByRole("button", { name: "Save requirements" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/recruiter/jobs/${JOB_ID}/requirements`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      requirements: [
        { text: "React experience", kind: "core", weight: 8 },
        { text: "SQL", kind: "nice", weight: 3 },
      ],
    });
    expect(await screen.findByText("Requirements saved.")).toBeTruthy();
  });

  it("compares and shows ranking, levels and the human review flag", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse(compareBody()));
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Compare top candidates" }));

    const table = await screen.findByRole("table");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/recruiter/jobs/${JOB_ID}/compare`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({});

    expect(within(table).getByText(/#1 Ada Lovelace/)).toBeTruthy();
    expect(within(table).getByText(/#2 Name not available/)).toBeTruthy();
    expect(within(table).getByText("Strong")).toBeTruthy();
    expect(within(table).getAllByText("Needs human review")).toHaveLength(1);
    expect(screen.getByText(/Compared 2 of 2 applicants/)).toBeTruthy();
  });

  it("sends refresh when asked to score everyone again", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse(compareBody()));
    renderPanel();

    await user.click(screen.getByLabelText(/Score everyone again/));
    await user.click(screen.getByRole("button", { name: "Compare top candidates" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh: true });
  });

  it("saves unsaved changes before comparing", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockImplementationOnce(() =>
        jsonResponse({ success: true, job_id: JOB_ID, requirements: [{ ...REQ, text: "React experience!" }] }),
      )
      .mockImplementationOnce(() => jsonResponse(compareBody()));
    renderPanel();

    await user.type(screen.getByLabelText("Requirement 1"), "!");
    await user.click(screen.getByRole("button", { name: "Compare top candidates" }));

    await screen.findByRole("table");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  it("shows the API error when the AI is not configured", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      jsonResponse({ success: false, error: "AI scoring is not set up.", code: "AI_NOT_CONFIGURED" }, 503),
    );
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Compare top candidates" }));

    expect((await screen.findByRole("alert")).textContent).toBe("AI scoring is not set up.");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a generic error when the network request fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("network down"));
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Compare top candidates" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong. Please try again.");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the API error when saving requirements fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse({ success: false, error: "Could not save." }, 500));
    renderPanel();

    await user.type(screen.getByLabelText("Requirement 1"), "!");
    await user.click(screen.getByRole("button", { name: "Save requirements" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Could not save.");
    expect(screen.queryByText("Requirements saved.")).toBeNull();
  });

  it("does not send a request when a weight is missing", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.clear(screen.getByLabelText("Weight of requirement 1"));
    await user.click(screen.getByRole("button", { name: "Save requirements" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Enter a weight from 1 to 10 for every requirement.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves an untouched default weight when the type changes", async () => {
    const user = userEvent.setup();
    renderPanel([{ ...REQ, weight: defaultWeight("core") }]);

    await user.selectOptions(screen.getByLabelText("Type of requirement 1"), "nice");

    expect((screen.getByLabelText("Weight of requirement 1") as HTMLInputElement).value).toBe(
      String(defaultWeight("nice")),
    );
  });

  it("keeps a weight the recruiter chose when the type changes", async () => {
    const user = userEvent.setup();
    renderPanel([{ ...REQ, weight: 9 }]);

    await user.selectOptions(screen.getByLabelText("Type of requirement 1"), "nice");

    expect((screen.getByLabelText("Weight of requirement 1") as HTMLInputElement).value).toBe("9");
  });

  it("sends an edited weight", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      jsonResponse({ success: true, job_id: JOB_ID, requirements: [{ ...REQ, weight: 5 }] }),
    );
    renderPanel();

    const weight = screen.getByLabelText("Weight of requirement 1");
    await user.clear(weight);
    await user.type(weight, "5");
    await user.click(screen.getByRole("button", { name: "Save requirements" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      requirements: [{ text: "React experience", kind: "core", weight: 5 }],
    });
  });

  it("removes a requirement from the list", async () => {
    const user = userEvent.setup();
    renderPanel([REQ, { id: "r2", text: "SQL", kind: "nice" as const, weight: 3 }]);

    await user.click(screen.getByRole("button", { name: "Remove requirement 1" }));

    expect(screen.queryByDisplayValue("React experience")).toBeNull();
    expect((screen.getByLabelText("Requirement 1") as HTMLInputElement).value).toBe("SQL");
  });

  it("lists candidates that could not be scored, with a name fallback", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      jsonResponse({
        ...compareBody(),
        failed: [
          { application_id: "a3", full_name: null, code: "http_error", message: "Jev returned HTTP 500." },
          { application_id: "a4", full_name: "Grace Hopper", code: "timeout", message: "Timed out." },
        ],
      }),
    );
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Compare top candidates" }));

    expect(await screen.findByText("Could not score")).toBeTruthy();
    expect(screen.getByText("Name not available: Jev returned HTTP 500.")).toBeTruthy();
    expect(screen.getByText("Grace Hopper: Timed out.")).toBeTruthy();
  });

  it("blocks comparing when there are no applicants", () => {
    renderPanel([REQ], 0);
    expect((screen.getByRole("button", { name: "Compare top candidates" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
