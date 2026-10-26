"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  GraduationCap,
  Languages,
  Link2,
  MapPin,
  FileText,
  UserRound,
  Plus,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import {
  getActiveApplicationResumes,
  submitJobApplication,
} from "@/app/jobs/actions";
import CoverLetterUpload from "./CoverLetterUpload";
import { getApplicationProfileImport } from "@/app/jobs/[jobID]/apply/profile-import-actions";

type Props = {
  jobId: string;
  jobTitle: string;
  company: string;
};

type Education = {
  id: number;
  school: string;
  degree: string;
  otherDegree: string;
  field: string;
  start: string;
  end: string;
};

type Experience = {
  id: number;
  title: string;
  employer: string;
  start: string;
  end: string;
  description: string;
};

type ResumeOption = {
  id: string;
  file_name: string;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#DDE3ED] bg-white px-3.5 py-3 text-sm text-[#0E1726] outline-none focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15";

const labelClass = "block text-sm font-semibold text-[#334155]";

const buttonClass =
  "rounded-xl bg-[#3151D5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50";

const degreeOptions = [
  "High School Diploma",
  "DEC (CEGEP)",
  "Certificate/Diploma",
  "Associate",
  "Bachelor's",
  "Master's",
  "PhD",
  "Other",
];

function Section({
  number,
  title,
  icon,
  children,
}: {
  number: number;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E3E6EB] bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#3151D5]">
          {icon}
        </span>
        <h2 className="text-lg font-extrabold text-[#0E1726]">
          {number}. {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function submissionError(reason: string): string {
  switch (reason) {
    case "already_applied":
      return "You have already applied for this job.";
    case "signed_out":
      return "Your session expired. Please sign in again.";
    case "job_unavailable":
      return "This job is no longer accepting applications.";
    case "resume_unavailable":
      return "The selected resume is no longer available.";
    case "invalid_input":
      return "Invalid application details.";
    default:
      return "Unable to submit your application. Please try again.";
  }
}

export default function JobApplicationForm({
  jobId,
  jobTitle,
  company,
}: Props) {
  const [personal, setPersonal] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [address, setAddress] = useState({
    street: "",
    city: "",
    province: "",
    postal: "",
    country: "",
  });

  const [education, setEducation] = useState<Education[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);

  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  const [skillDraft, setSkillDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("");

  const [links, setLinks] = useState({
    linkedin: "",
    portfolio: "",
  });

  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [loadingResumes, setLoadingResumes] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] =
    useState<string | null>(null);
  const [error, setError] = useState("");
  const [importingProfile, setImportingProfile] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getActiveApplicationResumes();

        if (cancelled) return;

        if (result.ok) {
          setResumes(result.resumes);
        } else {
          setError(
            result.reason === "signed_out"
              ? "Please sign in to access your saved resumes."
              : "Unable to load saved resumes."
          );
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load saved resumes.");
        }
      } finally {
        if (!cancelled) setLoadingResumes(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function addEducation() {
    setEducation((items) => [
      ...items,
      {
        id: Date.now() + Math.random(),
        school: "",
        degree: "",
        otherDegree: "",
        field: "",
        start: "",
        end: "",
      },
    ]);
  }

  function addExperience() {
    setExperience((items) => [
      ...items,
      {
        id: Date.now() + Math.random(),
        title: "",
        employer: "",
        start: "",
        end: "",
        description: "",
      },
    ]);
  }

  function addTag(kind: "skills" | "languages") {
    const value =
      (kind === "skills" ? skillDraft : languageDraft).trim();

    if (!value) return;

    if (kind === "skills") {
      setSkills((items) =>
        items.some((x) => x.toLowerCase() === value.toLowerCase())
          ? items
          : [...items, value]
      );
      setSkillDraft("");
    } else {
      setLanguages((items) =>
        items.some((x) => x.toLowerCase() === value.toLowerCase())
          ? items
          : [...items, value]
      );
      setLanguageDraft("");
    }
  }

  async function fillFromProfile() {
    if (importingProfile) return;

    const hasExistingDetails =
      Object.values(personal).some((value) => value.trim() !== "") ||
      education.length > 0 ||
      experience.length > 0 ||
      skills.length > 0 ||
      languages.length > 0;

    if (
      hasExistingDetails &&
      !window.confirm(
        "Replace your current personal details, education, experience, skills and languages with your saved profile?"
      )
    ) {
      return;
    }

    setImportingProfile(true);
    setImportMessage("");

    try {
      const result = await getApplicationProfileImport();
      if (!result.success) {
        setImportMessage(result.error);
        return;
      }

      // The profile does not expose a phone number. Preserve any manual entry.
      setPersonal((current) => ({
        ...current,
        ...result.personal,
        phone: current.phone,
      }));

      setEducation(
        result.education.map((item, index) => {
          const listedDegree = degreeOptions.includes(item.degree);
          return {
            id: index + 1,
            school: item.school,
            degree: !item.degree ? "" : listedDegree ? item.degree : "Other",
            otherDegree: item.degree && !listedDegree ? item.degree : "",
            field: item.field,
            start: item.start,
            end: item.end,
          };
        })
      );

      setExperience(
        result.experience.map((item, index) => ({
          id: index + 1,
          ...item,
        }))
      );
      setSkills(result.skills);
      setLanguages(result.languages);
      setImportMessage(
        "Profile imported. Review and edit the information before continuing."
      );
    } catch {
      setImportMessage("Unable to import your profile. Please try again.");
    } finally {
      setImportingProfile(false);
    }
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedResumeId) {
      setError("Please select a saved resume.");
      return;
    }

    setAcknowledged(false);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (submitting || !acknowledged || !selectedResumeId) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await submitJobApplication({
        jobId,
        resumeId: selectedResumeId,
      });

      if (result.ok) {
        setSubmittedApplicationId(result.applicationId);
        setConfirmOpen(false);
      } else {
        setError(submissionError(result.reason));
        setConfirmOpen(false);
      }
    } catch {
      setError(
        "The submission result could not be confirmed. Check My Applications before trying again."
      );
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedApplicationId) {
    return (
      <section
        role="status"
        className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm"
      >
        <h2 className="text-2xl font-extrabold text-green-800">
          Application submitted successfully!
        </h2>
        <p className="mt-3 text-sm text-[#475569]">
          Your application for {jobTitle} at {company} was submitted
          with your selected saved resume.
        </p>
        <CoverLetterUpload applicationId={submittedApplicationId} />
        <Link
          href="/application-status"
          className={`${buttonClass} mt-6 inline-flex`}
        >
          View my applications
        </Link>
      </section>
    );
  }

  return (
    <>
      <form onSubmit={handleContinue} className="space-y-5">
        <div className="rounded-2xl border border-[#C7D2FE] bg-[#F7F9FF] p-5">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-[#3151D5]" />
            <div>
              <h2 className="font-bold text-[#0E1726]">
                Speed up your application
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Import your saved profile details or enter them manually.
                Resume parsing is not connected yet.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void fillFromProfile()}
                  disabled={importingProfile}
                  className="rounded-xl bg-[#3151D5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importingProfile ? "Importing..." : "Fill from profile"}
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-xl border px-4 py-2 text-sm opacity-50"
                >
                  Fill from resume — coming soon
                </button>
              </div>
              {importMessage && (
                <p role="status" className="mt-3 text-sm text-[#475569]">
                  {importMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        <Section
          number={1}
          title="Personal information"
          icon={<UserRound className="mx-auto h-5 w-5" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["email", "Email address"],
                ["phone", "Phone number"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className={labelClass}>
                {label} *
                <input
                  required
                  className={inputClass}
                  type={
                    key === "email"
                      ? "email"
                      : key === "phone"
                        ? "tel"
                        : "text"
                  }
                  value={personal[key]}
                  onChange={(e) =>
                    setPersonal((p) => ({
                      ...p,
                      [key]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </Section>

        <Section
          number={2}
          title="Address"
          icon={<MapPin className="mx-auto h-5 w-5" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["street", "Street address"],
                ["city", "City"],
                ["province", "Province / State"],
                ["postal", "Postal / ZIP code"],
                ["country", "Country"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={`${labelClass} ${
                  key === "street" ? "sm:col-span-2" : ""
                }`}
              >
                {label}
                <input
                  className={inputClass}
                  value={address[key]}
                  onChange={(e) =>
                    setAddress((a) => ({
                      ...a,
                      [key]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </Section>

        <Section
          number={3}
          title="Education"
          icon={<GraduationCap className="mx-auto h-5 w-5" />}
        >
          <div className="space-y-4">
            {education.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border bg-[#FAFBFE] p-4"
              >
                <div className="mb-4 flex justify-between">
                  <strong>Education {index + 1}</strong>
                  <button
                    type="button"
                    aria-label={`Remove education ${index + 1}`}
                    onClick={() =>
                      setEducation((items) =>
                        items.filter((x) => x.id !== item.id)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    School / Institution
                    <input
                      className={inputClass}
                      value={item.school}
                      onChange={(e) =>
                        setEducation((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? { ...x, school: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </label>

                  <label className={labelClass}>
                    Degree / Diploma
                    <select
                      className={inputClass}
                      value={item.degree}
                      onChange={(e) =>
                        setEducation((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? { ...x, degree: e.target.value }
                              : x
                          )
                        )
                      }
                    >
                      <option value="">Select a degree</option>
                      {degreeOptions.map((degree) => (
                        <option key={degree} value={degree}>
                          {degree}
                        </option>
                      ))}
                    </select>
                  </label>

                  {item.degree === "Other" && (
                    <label className={`${labelClass} sm:col-span-2`}>
                      Specify degree
                      <input
                        className={inputClass}
                        value={item.otherDegree}
                        onChange={(e) =>
                          setEducation((items) =>
                            items.map((x) =>
                              x.id === item.id
                                ? { ...x, otherDegree: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </label>
                  )}

                  <label className={labelClass}>
                    Field of study
                    <input
                      className={inputClass}
                      value={item.field}
                      onChange={(e) =>
                        setEducation((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? { ...x, field: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </label>

                  {(["start", "end"] as const).map((key) => (
                    <label key={key} className={labelClass}>
                      {key === "start" ? "Start date" : "Graduation date"}
                      <input
                        type="month"
                        className={inputClass}
                        value={item[key]}
                        onChange={(e) =>
                          setEducation((items) =>
                            items.map((x) =>
                              x.id === item.id
                                ? { ...x, [key]: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addEducation}
            className="mt-4 flex items-center gap-2 rounded-xl border border-[#C7D2FE] px-4 py-2 text-sm font-semibold text-[#3151D5]"
          >
            <Plus className="h-4 w-4" /> Add education
          </button>
        </Section>

        <Section
          number={4}
          title="Work experience"
          icon={<BriefcaseBusiness className="mx-auto h-5 w-5" />}
        >
          <div className="space-y-4">
            {experience.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border bg-[#FAFBFE] p-4"
              >
                <div className="mb-4 flex justify-between">
                  <strong>Experience {index + 1}</strong>
                  <button
                    type="button"
                    aria-label={`Remove experience ${index + 1}`}
                    onClick={() =>
                      setExperience((items) =>
                        items.filter((x) => x.id !== item.id)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["title", "Job title"],
                      ["employer", "Company"],
                      ["start", "Start date"],
                      ["end", "End date"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className={labelClass}>
                      {label}
                      <input
                        className={inputClass}
                        type={
                          key === "start" || key === "end"
                            ? "month"
                            : "text"
                        }
                        value={item[key]}
                        onChange={(e) =>
                          setExperience((items) =>
                            items.map((x) =>
                              x.id === item.id
                                ? { ...x, [key]: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </label>
                  ))}

                  <label className={`${labelClass} sm:col-span-2`}>
                    Responsibilities and achievements
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={item.description}
                      onChange={(e) =>
                        setExperience((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? { ...x, description: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addExperience}
            className="mt-4 flex items-center gap-2 rounded-xl border border-[#C7D2FE] px-4 py-2 text-sm font-semibold text-[#3151D5]"
          >
            <Plus className="h-4 w-4" /> Add experience
          </button>
        </Section>

        <Section
          number={5}
          title="Skills and languages"
          icon={<Languages className="mx-auto h-5 w-5" />}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            {(["skills", "languages"] as const).map((kind) => {
              const items = kind === "skills" ? skills : languages;
              const draft =
                kind === "skills" ? skillDraft : languageDraft;

              return (
                <div key={kind}>
                  <label className={labelClass}>
                    {kind === "skills" ? "Relevant skills" : "Languages"}
                  </label>

                  <div className="flex items-end gap-2">
                    <input
                      className={inputClass}
                      placeholder={
                        kind === "skills" ? "e.g. Python" : "e.g. French"
                      }
                      value={draft}
                      onChange={(e) =>
                        kind === "skills"
                          ? setSkillDraft(e.target.value)
                          : setLanguageDraft(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(kind);
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => addTag(kind)}
                      className="rounded-xl border px-4 py-3 text-sm"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {items.map((value) => (
                      <span
                        key={value}
                        className="flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#F7F9FF] px-3 py-1.5 text-sm text-[#3151D5]"
                      >
                        {value}
                        <button
                          type="button"
                          aria-label={`Remove ${value}`}
                          onClick={() =>
                            kind === "skills"
                              ? setSkills((list) =>
                                  list.filter((x) => x !== value)
                                )
                              : setLanguages((list) =>
                                  list.filter((x) => x !== value)
                                )
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          number={6}
          title="Professional links"
          icon={<Link2 className="mx-auto h-5 w-5" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["linkedin", "LinkedIn URL"],
                ["portfolio", "Portfolio / GitHub URL"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className={labelClass}>
                {label}
                <input
                  type="url"
                  placeholder="https://"
                  className={inputClass}
                  value={links[key]}
                  onChange={(e) =>
                    setLinks((current) => ({
                      ...current,
                      [key]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </Section>

        <Section
          number={7}
          title="Application documents"
          icon={<FileText className="mx-auto h-5 w-5" />}
        >
          <div className="space-y-4">
            <label className={labelClass}>
              Saved resume / CV *
              <select
                required
                disabled={loadingResumes}
                className={inputClass}
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                <option value="">
                  {loadingResumes
                    ? "Loading resumes..."
                    : "Choose a saved resume"}
                </option>

                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.file_name}
                  </option>
                ))}
              </select>
            </label>

            <Link
              href="/upload-resume"
              className="inline-block text-sm font-semibold text-[#3151D5] hover:underline"
            >
              Upload a new resume
            </Link>

            {!loadingResumes && resumes.length === 0 && (
              <p className="text-sm text-[#64748B]">
                No saved resumes available. Upload a resume first,
                then return to this page.
              </p>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Submission notice:</strong> The current backend
              only saves the application record and selected resume.
              The additional form fields above are not currently
              saved or sent to recruiters.
            </div>
          </div>
        </Section>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 rounded-2xl border bg-white p-5">
          <Link
            href={`/jobs?selectedJob=${encodeURIComponent(jobId)}`}
            className="rounded-xl border px-5 py-3 text-sm font-semibold"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loadingResumes || submitting}
            className={buttonClass}
          >
            Continue to confirmation
          </button>
        </div>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1726]/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="confirm-title"
              className="text-xl font-extrabold text-[#0E1726]"
            >
              Confirm your application
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#475569]">
              You are applying for <strong>{jobTitle}</strong> at{" "}
              <strong>{company}</strong>.
            </p>

            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Only your selected resume and application record
              will be saved. The other form details are not
              included in this submission.
            </p>

            <label className="mt-4 flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={submitting}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I understand what will be submitted.
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              >
                Go back
              </button>

              <button
                type="button"
                disabled={!acknowledged || submitting}
                onClick={() => void handleConfirm()}
                className={buttonClass}
              >
                {submitting ? "Submitting..." : "Confirm submission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
