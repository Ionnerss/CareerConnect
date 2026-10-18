"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CompareResponse,
  RequirementsResponse,
  SavedRequirement,
} from "@/lib/recruiter/candidate-comparison-service";
import {
  buildComparisonRows,
  defaultWeight,
  draftsFromSaved,
  draftsToPayload,
  formatConfidence,
  hasUnsavedChanges,
  validateDrafts,
  type RequirementDraft,
  type RequirementKind,
} from "@/lib/recruiter/comparison-view";
import { MAX_REQUIREMENTS } from "@/lib/validations/job-requirements";

type CompareSuccess = Extract<CompareResponse, { success: true }>;

type Props = {
  jobId: string;
  initialRequirements: SavedRequirement[];
  applicantCount: number;
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function requestJson<T extends { success: boolean }>(
  url: string,
  init: RequestInit,
): Promise<T | { success: false; error: string }> {
  try {
    const response = await fetch(url, init);
    return (await response.json()) as T;
  } catch {
    return { success: false, error: GENERIC_ERROR };
  }
}

export default function CandidateComparison({ jobId, initialRequirements, applicantCount }: Props) {
  const keyCounter = useRef(0);
  const nextKey = () => `new-${keyCounter.current++}`;

  const [saved, setSaved] = useState<SavedRequirement[]>(initialRequirements);
  const [drafts, setDrafts] = useState<RequirementDraft[]>(() =>
    initialRequirements.length > 0
      ? draftsFromSaved(initialRequirements)
      : [{ key: "new-initial", text: "", kind: "core", weight: defaultWeight("core") }],
  );
  const [busy, setBusy] = useState<null | "saving" | "comparing">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [result, setResult] = useState<CompareSuccess | null>(null);

  const dirty = hasUnsavedChanges(drafts, saved);
  const hasRequirements = draftsToPayload(drafts).length > 0;
  const canCompare = busy === null && applicantCount > 0 && hasRequirements;

  function updateDraft(key: string, changes: Partial<RequirementDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );
  }

  function changeKind(draft: RequirementDraft, kind: RequirementKind) {
    // Move the weight to the new default only if it was still the old default.
    const weight = draft.weight === defaultWeight(draft.kind) ? defaultWeight(kind) : draft.weight;
    updateDraft(draft.key, { kind, weight });
  }

  function addRequirement(kind: RequirementKind) {
    setDrafts((current) => [
      ...current,
      { key: nextKey(), text: "", kind, weight: defaultWeight(kind) },
    ]);
  }

  function removeRequirement(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  async function saveRequirements(): Promise<boolean> {
    const problem = validateDrafts(drafts);
    if (problem) {
      setError(problem);
      return false;
    }

    const response = await requestJson<RequirementsResponse>(
      `/api/recruiter/jobs/${jobId}/requirements`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: draftsToPayload(drafts) }),
      },
    );
    if (!response.success) {
      setError(response.error);
      return false;
    }

    setSaved(response.requirements);
    setDrafts(draftsFromSaved(response.requirements));
    setResult(null); // the old table was built from the old requirements
    return true;
  }

  async function handleSave() {
    setBusy("saving");
    setError(null);
    setNotice(null);
    if (await saveRequirements()) setNotice("Requirements saved.");
    setBusy(null);
  }

  async function handleCompare() {
    setBusy("comparing");
    setError(null);
    setNotice(null);

    if (dirty && !(await saveRequirements())) {
      setBusy(null);
      return;
    }

    const response = await requestJson<CompareResponse>(`/api/recruiter/jobs/${jobId}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refresh ? { refresh: true } : {}),
    });
    if (response.success) {
      setResult(response);
    } else {
      setError(response.error);
    }
    setBusy(null);
  }

  const rows = result ? buildComparisonRows(result.requirements, result.ranked) : [];
  const reusedCount = result ? result.ranked.filter((candidate) => candidate.cached).length : 0;

  return (
    <section aria-labelledby="compare-heading" className="mt-10 border-t border-border pt-8">
      <h2 id="compare-heading" className="text-xl font-semibold">
        Compare top candidates
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        List what this role needs, then compare applicants against it. Weight each requirement
        from 1 to 10 (1 = minor, 5 = important, 10 = must-have).
      </p>

      <ul className="mt-4 space-y-2">
        {drafts.map((draft, index) => (
          <li key={draft.key} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Requirement ${index + 1}`}
              placeholder="e.g. 2+ years of React experience"
              value={draft.text}
              maxLength={300}
              onChange={(event) => updateDraft(draft.key, { text: event.target.value })}
              className="min-w-60 flex-1"
            />
            <select
              aria-label={`Type of requirement ${index + 1}`}
              value={draft.kind}
              onChange={(event) => changeKind(draft, event.target.value as RequirementKind)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="core">Core</option>
              <option value="nice">Nice to have</option>
            </select>
            <Input
              aria-label={`Weight of requirement ${index + 1}`}
              type="number"
              min={1}
              max={10}
              step={1}
              value={Number.isNaN(draft.weight) ? "" : draft.weight}
              onChange={(event) => updateDraft(draft.key, { weight: event.target.valueAsNumber })}
              className="w-20"
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove requirement ${index + 1}`}
              onClick={() => removeRequirement(draft.key)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={drafts.length >= MAX_REQUIREMENTS}
          onClick={() => addRequirement("core")}
        >
          Add core requirement
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={drafts.length >= MAX_REQUIREMENTS}
          onClick={() => addRequirement("nice")}
        >
          Add nice-to-have
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Privacy: to score applicants, their skills, education and work history are sent to a
        third-party AI model (Jev by TypeSafe AI). Names, emails, company names and school names
        are not sent. The scores are suggestions only. You make every decision.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleCompare} disabled={!canCompare}>
          {busy === "comparing" ? "Comparing…" : "Compare top candidates"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSave}
          disabled={busy !== null || !dirty}
        >
          {busy === "saving" ? "Saving…" : "Save requirements"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={refresh}
            onChange={(event) => setRefresh(event.target.checked)}
          />
          Score everyone again (ignore saved results)
        </label>
      </div>

      {applicantCount === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          No one has applied yet, so there is nobody to compare.
        </p>
      )}
      {busy === "comparing" && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Scoring applicants. This can take a few seconds.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            Compared {result.compared_count} of {result.total_applicants} applicant
            {result.total_applicants === 1 ? "" : "s"}
            {result.total_applicants > result.compared_count ? " (oldest applications first)" : ""}
            {reusedCount > 0 ? `. Saved results were reused for ${reusedCount}.` : "."}
            {!result.saved && " These results could not be saved, so they will be scored again next time."}
          </p>

          {result.ranked.length > 0 && (
            <>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th scope="col" className="sticky left-0 bg-muted px-4 py-3 font-medium">
                        Requirement
                      </th>
                      {result.ranked.map((candidate, index) => (
                        <th
                          key={candidate.application_id}
                          scope="col"
                          className="min-w-36 px-4 py-3 align-top font-medium"
                        >
                          <div className="text-foreground">
                            #{index + 1} {candidate.full_name ?? "Name not available"}
                          </div>
                          <div>Score {candidate.score}/100</div>
                          {candidate.needs_human_review && (
                            <span className="mt-1 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              Needs human review
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.requirement.id} className="border-t border-border">
                        <th
                          scope="row"
                          className="sticky left-0 bg-background px-4 py-3 text-left font-normal"
                        >
                          <div>{row.requirement.text}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.requirement.kind === "core" ? "Core" : "Nice to have"} · weight{" "}
                            {row.requirement.weight}
                          </div>
                        </th>
                        {row.cells.map((cell) => (
                          <td key={cell.applicationId} className="px-4 py-3">
                            {cell.level ? (
                              <>
                                <span className="font-medium">{cell.level}</span>{" "}
                                <span
                                  className={
                                    cell.lowConfidence
                                      ? "text-xs text-destructive"
                                      : "text-xs text-muted-foreground"
                                  }
                                >
                                  ({formatConfidence(cell.confidence ?? 0)} sure)
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Each cell shows how clearly the profile supports the requirement (None, Weak, Clear
                or Strong) and how sure the model is. Low confidence is shown in red. The overall
                score weighs each requirement by its weight.
              </p>
            </>
          )}

          {result.failed.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium">Could not score</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {result.failed.map((candidate) => (
                  <li key={candidate.application_id}>
                    {candidate.full_name ?? "Name not available"}: {candidate.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
