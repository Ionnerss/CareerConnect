"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { getApplicationProfileImport } from "@/app/jobs/[jobID]/apply/profile-import-actions";
import Link from "next/link";
import { DEGREE_OPTIONS } from "@/components/profile/education-section";
import { BriefcaseBusiness, GraduationCap, Link2, Languages, FileText, MapPin, Plus, Trash2, UserRound, Sparkles, X } from "lucide-react";

type Education = { id: number; school: string; degree: string; degreeChoice: string; degreeOther: string; field: string; start: string; end: string };
type Experience = { id: number; title: string; employer: string; start: string; end: string; description: string };
type Props = { jobId: string; jobTitle: string; company: string };

const fieldClass = "mt-1.5 w-full rounded-xl border border-[#DDE3ED] bg-white px-3.5 py-3 text-sm text-[#0E1726] outline-none transition focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15";
const labelClass = "block text-sm font-semibold text-[#334155]";

function isListedDegree(value: string): boolean {
  return (DEGREE_OPTIONS as readonly string[]).includes(value);
}

function Section({ icon: Icon, title, number, children }: { icon: typeof UserRound; title: string; number: number; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E3E6EB] bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#3151D5]"><Icon className="h-5 w-5" /></span>
        <h2 className="text-lg font-extrabold text-[#0E1726]">{number}. {title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function JobApplicationForm({ jobId, jobTitle, company }: Props) {
  const [personal, setPersonal] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [address, setAddress] = useState({ street: "", city: "", province: "", postal: "", country: "" });
  const [education, setEducation] = useState<Education[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [links, setLinks] = useState({ linkedin: "", portfolio: "" });
  const [resume, setResume] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [nextId, setNextId] = useState(1);

  function addEducation() {
    setEducation((list) => [...list, { id: nextId, school: "", degree: "", degreeChoice: "", degreeOther: "", field: "", start: "", end: "" }]);
    setNextId((id) => id + 1);
  }
  function addExperience() {
    setExperience((list) => [...list, { id: nextId, title: "", employer: "", start: "", end: "", description: "" }]);
    setNextId((id) => id + 1);
  }
  function updateEducation(id: number, key: keyof Omit<Education, "id">, value: string) {
    setEducation((list) => list.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }
  function updateDegreeChoice(id: number, choice: string) {
    setEducation((list) => list.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        degreeChoice: choice,
        degree: choice === "Other" ? item.degreeOther : choice,
      };
    }));
  }

  function updateOtherDegree(id: number, value: string) {
    setEducation((list) => list.map((item) => item.id === id
      ? { ...item, degreeOther: value, degree: value }
      : item));
  }

  function updateExperience(id: number, key: keyof Omit<Experience, "id">, value: string) {
    setExperience((list) => list.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }
  function addTag(kind: "skills" | "languages") {
    const value = (kind === "skills" ? skillDraft : languageDraft).trim();
    if (!value) return;
    const current = kind === "skills" ? skills : languages;
    if (!current.some((item) => item.toLowerCase() === value.toLowerCase())) {
      if (kind === "skills") setSkills((list) => [...list, value]);
      else setLanguages((list) => [...list, value]);
    }
    if (kind === "skills") setSkillDraft("");
    else setLanguageDraft("");
  }

  async function fillFromProfile() {
    const hasContent = Boolean(
      Object.values(personal).some(Boolean) || education.length || experience.length ||
      skills.length || languages.length
    );
    if (hasContent && !window.confirm("Replace your current personal details, education, experience, skills and languages with your saved profile?")) return;
    setImporting(true);
    setImportMessage("");
    try {
      const result = await getApplicationProfileImport();
      if (!result.success) {
        setImportMessage(result.error);
        return;
      }
      setPersonal(result.personal);
      setEducation(result.education.map((item, index) => ({
         id: index + 1,
         ...item,
         degreeChoice: !item.degree ? "" : isListedDegree(item.degree) ? item.degree : "Other",
         degreeOther: item.degree && !isListedDegree(item.degree) ? item.degree : "",
       })));
      setExperience(result.experience.map((item, index) => ({ id: result.education.length + index + 1, ...item })));
      setNextId(result.education.length + result.experience.length + 1);
      setSkills(result.skills);
      setLanguages(result.languages);
      setImportMessage("Your saved profile details have been imported. Review and edit them before applying.");
    } catch {
      setImportMessage("Unable to import your profile. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function requestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    if (!resume) {
      setFeedback("Please attach a resume before continuing.");
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <>
      <form onSubmit={requestSubmit} className="space-y-5">
        <div className="rounded-2xl border border-[#C7D2FE] bg-[#F7F9FF] p-5 sm:p-6">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#3151D5]" />
            <div>
              <h2 className="font-extrabold text-[#0E1726]">Speed up your application</h2>
              <p className="mt-1 text-sm text-[#64748B]">Enter your details manually or import your saved CareerConnect profile. Resume parsing is not available yet.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={fillFromProfile} disabled={importing} className="rounded-xl bg-[#3151D5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50">{importing ? "Importing..." : "Fill from profile"}</button>
                <button type="button" disabled title="Resume parsing is not connected yet" className="cursor-not-allowed rounded-xl border border-[#C7D2FE] bg-white px-4 py-2.5 text-sm font-semibold text-[#3151D5] opacity-50">Fill from resume — coming soon</button>
              </div>
              {importMessage && <p role="status" className="mt-3 text-sm text-[#334155]">{importMessage}</p>}
            </div>
          </div>
        </div>

        <Section icon={UserRound} title="Personal information" number={1}>
          <div className="grid gap-4 sm:grid-cols-2">
            {([ ["firstName", "First name"], ["lastName", "Last name"], ["email", "Email address"], ["phone", "Phone number"] ] as const).map(([key, label]) => (
              <label key={key} className={labelClass}>{label} <span className="text-[#3151D5]">*</span>
                <input className={fieldClass} required type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} autoComplete={key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : key === "email" ? "email" : "tel"} value={personal[key]} onChange={(event) => setPersonal((p) => ({ ...p, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
        </Section>

        <Section icon={MapPin} title="Address" number={2}>
          <div className="grid gap-4 sm:grid-cols-2">
            {([ ["street", "Street address"], ["city", "City"], ["province", "Province / State"], ["postal", "Postal / ZIP code"], ["country", "Country"] ] as const).map(([key, label]) => (
              <label key={key} className={`${labelClass} ${key === "street" ? "sm:col-span-2" : ""}`}>{label}
                <input className={fieldClass} value={address[key]} onChange={(event) => setAddress((a) => ({ ...a, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
        </Section>

        <Section icon={GraduationCap} title="Education" number={3}>
          {education.length === 0 && <p className="mb-4 rounded-xl border border-dashed border-[#DDE3ED] p-5 text-center text-sm text-[#64748B]">No education added yet.</p>}
          <div className="space-y-4">
            {education.map((item, i) => (
              <div key={item.id} className="rounded-xl border border-[#E3E6EB] bg-[#FAFBFE] p-4">
                <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Education {i + 1}</strong><button type="button" aria-label={`Remove education ${i + 1}`} onClick={() => setEducation((list) => list.filter((x) => x.id !== item.id))} className="text-[#64748B] hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    School / Institution
                    <input className={fieldClass} value={item.school} onChange={(event) => updateEducation(item.id, "school", event.target.value)} />
                  </label>
                  <div>
                    <label htmlFor={`degree-${item.id}`} className={labelClass}>Degree / Diploma</label>
                    <select
                      id={`degree-${item.id}`}
                      className={fieldClass}
                      value={item.degreeChoice}
                      onChange={(event) => updateDegreeChoice(item.id, event.target.value)}
                    >
                      <option value="">Select a degree</option>
                      {DEGREE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                    {item.degreeChoice === "Other" && (
                      <label className={`${labelClass} mt-3`}>
                        Specify degree
                        <input
                          className={fieldClass}
                          placeholder="e.g. Undergraduate certificate"
                          maxLength={200}
                          value={item.degreeOther}
                          onChange={(event) => updateOtherDegree(item.id, event.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  {([ ["field", "Field of study"], ["start", "Start date"], ["end", "Graduation date"] ] as const).map(([key, label]) => (
                    <label key={key} className={labelClass}>
                      {label}
                      <input
                        className={fieldClass}
                        type={key === "start" || key === "end" ? "month" : "text"}
                        value={item[key]}
                        onChange={(event) => updateEducation(item.id, key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addEducation} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#C7D2FE] px-4 py-2.5 text-sm font-semibold text-[#3151D5] hover:bg-[#EEF2FF]"><Plus className="h-4 w-4" /> Add education</button>
        </Section>

        <Section icon={BriefcaseBusiness} title="Work experience" number={4}>
          {experience.length === 0 && <p className="mb-4 rounded-xl border border-dashed border-[#DDE3ED] p-5 text-center text-sm text-[#64748B]">No experience added yet.</p>}
          <div className="space-y-4">
            {experience.map((item, i) => (
              <div key={item.id} className="rounded-xl border border-[#E3E6EB] bg-[#FAFBFE] p-4">
                <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Experience {i + 1}</strong><button type="button" aria-label={`Remove experience ${i + 1}`} onClick={() => setExperience((list) => list.filter((x) => x.id !== item.id))} className="text-[#64748B] hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([ ["title", "Job title"], ["employer", "Company"], ["start", "Start date"], ["end", "End date"] ] as const).map(([key, label]) => (
                    <label key={key} className={labelClass}>{label}<input className={fieldClass} type={key === "start" || key === "end" ? "month" : "text"} value={item[key]} onChange={(event) => updateExperience(item.id, key, event.target.value)} /></label>
                  ))}
                  <label className={`${labelClass} sm:col-span-2`}>Responsibilities and achievements<textarea rows={3} className={fieldClass} value={item.description} onChange={(event) => updateExperience(item.id, "description", event.target.value)} /></label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addExperience} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#C7D2FE] px-4 py-2.5 text-sm font-semibold text-[#3151D5] hover:bg-[#EEF2FF]"><Plus className="h-4 w-4" /> Add experience</button>
        </Section>

        <Section icon={Languages} title="Skills and languages" number={5}>
          <div className="grid gap-6 sm:grid-cols-2">
            {(["skills", "languages"] as const).map((kind) => {
              const items = kind === "skills" ? skills : languages;
              const draft = kind === "skills" ? skillDraft : languageDraft;
              const setDraft = kind === "skills" ? setSkillDraft : setLanguageDraft;
              return (
                <div key={kind}>
                  <label htmlFor={`${kind}-entry`} className={labelClass}>
                    {kind === "skills" ? "Relevant skills" : "Languages"}
                  </label>
                  <div className="flex items-end gap-2">
                    <input
                      id={`${kind}-entry`}
                      className={fieldClass}
                      placeholder={kind === "skills" ? "e.g. Python" : "e.g. French"}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag(kind);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addTag(kind)}
                      className="rounded-xl border border-[#C7D2FE] px-4 py-3 text-sm font-semibold text-[#3151D5] hover:bg-[#EEF2FF]"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-3 flex min-h-8 flex-wrap gap-2" aria-live="polite">
                    {items.map((item) => (
                      <span key={item} className="inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#F7F9FF] px-3 py-1.5 text-sm text-[#3151D5]">
                        {item}
                        <button
                          type="button"
                          aria-label={`Remove ${item}`}
                          onClick={() => kind === "skills" ? setSkills((list) => list.filter((value) => value !== item)) : setLanguages((list) => list.filter((value) => value !== item))}
                          className="rounded-full hover:text-red-600"
                        ><X className="h-3.5 w-3.5" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section icon={Link2} title="Professional links" number={6}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>LinkedIn URL<input className={fieldClass} type="url" placeholder="https://linkedin.com/in/..." value={links.linkedin} onChange={(event) => setLinks((p) => ({ ...p, linkedin: event.target.value }))} /></label>
            <label className={labelClass}>Portfolio / GitHub URL<input className={fieldClass} type="url" placeholder="https://github.com/..." value={links.portfolio} onChange={(event) => setLinks((p) => ({ ...p, portfolio: event.target.value }))} /></label>
          </div>
        </Section>

        <Section icon={FileText} title="Application documents" number={7}>
          <div className="space-y-4">
            <label className={labelClass}>Resume / CV <span className="text-[#3151D5]">*</span>
              <input type="file" accept=".pdf,.doc,.docx" className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF2FF] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#3151D5]`} onChange={(event) => setResume(event.target.files?.[0] ?? null)} />
              <span className="mt-1 block text-xs font-normal text-[#64748B]">PDF, DOC, or DOCX. Upload is not connected to storage yet.</span>
            </label>
            <label className={labelClass}>Cover letter (optional)<input type="file" accept=".pdf,.doc,.docx" className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF2FF] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#3151D5]`} onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} /><span className="mt-1 block text-xs font-normal text-[#64748B]">PDF, DOC or DOCX. {coverFile ? `Selected: ${coverFile.name}` : "No cover letter selected."} File storage is not connected yet.</span></label>
          </div>
        </Section>

        {feedback && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{feedback}</p>}
        <div className="flex flex-wrap justify-end gap-3 rounded-2xl border border-[#E3E6EB] bg-white p-5 shadow-sm">
          <Link href={`/jobs?selectedJob=${encodeURIComponent(jobId)}`} className="rounded-xl border border-[#DDE3ED] px-5 py-3 text-sm font-semibold text-[#334155] hover:bg-[#F5F6F8]">Cancel</Link>
          <button type="submit" className="rounded-xl bg-[#3151D5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF]">Submit application</button>
        </div>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1726]/60 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><h2 id="confirm-title" className="text-xl font-extrabold text-[#0E1726]">Confirm your application</h2><button type="button" aria-label="Close confirmation" onClick={() => setConfirmOpen(false)}><X className="h-5 w-5 text-[#64748B]" /></button></div>
            <p className="mt-3 text-sm leading-6 text-[#475569]">You are preparing to apply for <strong>{jobTitle}</strong> at <strong>{company}</strong>. Check that your details and resume are correct.</p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Application submission is not connected to the backend yet. Nothing will be sent.</p>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-[#DDE3ED] px-4 py-2.5 text-sm font-semibold">Go back</button><button type="button" disabled className="cursor-not-allowed rounded-xl bg-[#3151D5] px-4 py-2.5 text-sm font-semibold text-white opacity-50">Confirm submission</button></div>
          </div>
        </div>
      )}
    </>
  );
}
