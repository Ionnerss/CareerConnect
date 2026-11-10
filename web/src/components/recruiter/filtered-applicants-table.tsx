
"use client";

import { ApplicantDocuments } from "@/components/recruiter/applicant-documents";
import ApplicantFilters from "@/components/recruiter/applicant-filters";
import ApplicantStatusSelect from "@/components/recruiter/select-applicant-status";

import type { ApplicationStatus } from "@/app/recruiter/jobs/[jobId]/applicants/actions";
import type { JobApplicant } from "@/lib/recruiter/applicants";

type FilteredApplicantsTableProps = {
  applicants: JobApplicant[];
  jobId: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Generate initials from an applicant's name.
function getApplicantInitials(name: string | null): string {
  if (!name?.trim()) {
    return "?";
  }

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export default function FilteredApplicantsTable({
  applicants,
  jobId,
}: FilteredApplicantsTableProps) {
  return (
    <ApplicantFilters applicants={applicants}>
      {(filteredApplicants) =>
        filteredApplicants.length === 0 ? (
          <div className="rounded-2xl border border-[#E3E6EB] bg-white px-6 py-10 text-center">
            <p className="font-semibold text-[#0E1726]">
              No matching applicants
            </p>

            <p className="mt-1 text-sm text-[#667085]">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E3E6EB] bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#F5F6F8] text-[#4B5563]">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                  >
                    Applicant
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                  >
                    Applied on
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                  >
                    Status
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                  >
                    Skill match
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                  >
                    Documents
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredApplicants.map((applicant) => {
                  const match = applicant.skill_match;

                  const matchPercent = match
                    ? Math.max(
                        0,
                        Math.min(100, match.percent)
                      )
                    : 0;

                  return (
                    <tr
                      key={applicant.application_id}
                      className="border-t border-[#EEF0F3] transition-colors hover:bg-[#FAFBFF]"
                    >
                      {/* Applicant name and initials */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#DCE5FF] bg-[#EDF2FF] text-sm font-bold text-[#3151D5]"
                          >
                            {getApplicantInitials(
                              applicant.full_name
                            )}
                          </div>

                          <div className="min-w-0">
                            {applicant.full_name ? (
                              <p className="font-semibold text-[#0E1726]">
                                {applicant.full_name}
                              </p>
                            ) : (
                              <p className="font-normal text-[#667085]">
                                Name not available
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Application date */}
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-[#4B5563]">
                        {dateFormatter.format(
                          new Date(applicant.applied_at)
                        )}
                      </td>

                      {/* Application status */}
                      <td className="px-4 py-3 align-middle">
                        <ApplicantStatusSelect
                          applicationId={applicant.application_id}
                          jobId={jobId}
                          initialStatus={
                            applicant.status as ApplicationStatus
                          }
                        />
                      </td>

                      {/* Skill match */}
                      <td className="px-4 py-3 align-middle">
                        {match ? (
                          <div className="min-w-[135px] max-w-[200px] space-y-2">
                            <div className="flex flex-wrap items-baseline gap-x-1.5">
                              <span className="font-bold text-[#0E1726]">
                                {match.percent}%
                              </span>

                              <span className="text-xs text-[#667085]">
                                ({match.matched.length} of{" "}
                                {match.matched.length +
                                  match.missing.length}{" "}
                                skills)
                              </span>
                            </div>

                            {/* Skill match progress bar */}
                            <div
                              role="progressbar"
                              aria-label={`Skill match for ${
                                applicant.full_name ??
                                "applicant"
                              }`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={matchPercent}
                              className="h-1.5 w-full overflow-hidden rounded-full bg-[#E9EDF5]"
                            >
                              <div
                                className="h-full rounded-full bg-[#3151D5] transition-all"
                                style={{
                                  width: `${matchPercent}%`,
                                }}
                              />
                            </div>

                            {/* Missing skills */}
                            {match.missing.length > 0 && (
                              <p className="text-xs leading-4 text-[#667085]">
                                Missing:{" "}
                                {match.missing.join(", ")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#667085]">
                            —
                          </span>
                        )}
                      </td>

                      {/* Resume and cover letter */}
                      <td className="px-4 py-2 align-middle">
                        <ApplicantDocuments
                          applicationId={applicant.application_id}
                          hasResume={applicant.has_resume}
                          hasCoverLetter={
                            applicant.has_cover_letter
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }
    </ApplicantFilters>
  );
}
