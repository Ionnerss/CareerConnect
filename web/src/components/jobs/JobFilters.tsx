
"use client";

import { useEffect, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  GraduationCap,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";

export type JobFilterValues = {
  location: string;
  minSalary: string;
  maxSalary: string;
  experienceLevel: string;
  jobType: string;
};

const emptyFilters: JobFilterValues = {
  location: "",
  minSalary: "",
  maxSalary: "",
  experienceLevel: "",
  jobType: "",
};

const SALARY_MAX = 200000;
const SALARY_STEP = 5000;

type JobFiltersProps = {
  onApply: (filters: JobFilterValues) => void;
  initialFilters?: JobFilterValues;
};

type FilterPanel = "location" | "salary" | "experience" | "jobType" | null;

export default function JobFilters({
  onApply,
  initialFilters = emptyFilters,
}: JobFiltersProps) {
  const [filters, setFilters] = useState<JobFilterValues>({
    ...initialFilters,
  });

  const [appliedFilters, setAppliedFilters] = useState<JobFilterValues>({
    ...initialFilters,
  });

  const [activePanel, setActivePanel] = useState<FilterPanel>(null);
  const [error, setError] = useState("");

  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePanel) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        setActivePanel(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePanel(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activePanel]);

  function updateFilter(field: keyof JobFilterValues, value: string) {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
    }));
    setError("");
  }

  function applyFilters() {
    const min =
      filters.minSalary === "" ? null : Number(filters.minSalary);

    const max =
      filters.maxSalary === "" ? null : Number(filters.maxSalary);

    if (
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0))
    ) {
      setError("Please enter valid, non-negative salary values.");
      return;
    }

    if (min !== null && max !== null && min > max) {
      setError("Minimum salary cannot exceed maximum salary.");
      return;
    }

    const nextFilters = { ...filters };

    setAppliedFilters(nextFilters);
    setError("");
    setActivePanel(null);
    onApply(nextFilters);
  }

  function clearFilters() {
    const cleared = { ...emptyFilters };

    setFilters(cleared);
    setAppliedFilters(cleared);
    setError("");
    setActivePanel(null);
    onApply(cleared);
  }

  function togglePanel(panel: Exclude<FilterPanel, null>) {
    setActivePanel((current) => (current === panel ? null : panel));
    setError("");
  }

  // Empty salary inputs represent an unrestricted bound.
  // The slider itself displays a practical $0–$200k range.
  const clampSalary = (value: number) =>
    Math.min(SALARY_MAX, Math.max(0, value));

  const parsedMin = Number(filters.minSalary);
  const parsedMax = Number(filters.maxSalary);

  const sliderMin =
    filters.minSalary === "" || !Number.isFinite(parsedMin)
      ? 0
      : clampSalary(parsedMin);

  const sliderMax =
    filters.maxSalary === "" || !Number.isFinite(parsedMax)
      ? SALARY_MAX
      : clampSalary(parsedMax);

  // Radix requires an ordered slider range. Invalid manual
  // input is still caught by applyFilters().
  const sliderValues: [number, number] = [
    Math.min(sliderMin, sliderMax),
    Math.max(sliderMin, sliderMax),
  ];

  function updateSalarySlider(values: number[]) {
    if (values.length !== 2) return;

    // Update only the handle that actually moved. A manually entered
    // salary above the slider's $200k limit must not be overwritten
    // when the user adjusts the opposite handle.
    setFilters((previous) => ({
      ...previous,
      minSalary:
        values[0] !== sliderValues[0]
          ? String(values[0])
          : previous.minSalary,
      maxSalary:
        values[1] !== sliderValues[1]
          ? String(values[1])
          : previous.maxSalary,
    }));

    setError("");
  }

  const activeCount = Object.values(appliedFilters).filter(Boolean).length;

  const hasLocation = Boolean(appliedFilters.location);
  const hasSalary = Boolean(
    appliedFilters.minSalary || appliedFilters.maxSalary
  );
  const hasExperience = Boolean(appliedFilters.experienceLevel);
  const hasJobType = Boolean(appliedFilters.jobType);

  const inputClass =
    "h-11 w-full min-w-0 rounded-xl border border-slate-200 " +
    "bg-white px-3 text-sm text-[#0E1726] outline-none " +
    "transition-colors placeholder:text-slate-400 " +
    "focus:border-[#1D4ED8] focus:ring-2 focus:ring-blue-100";

  const pillClass = (selected: boolean, open: boolean) =>
    "inline-flex h-11 items-center gap-2 rounded-full border px-4 " +
    "text-sm font-semibold transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
    (selected || open
      ? "border-blue-300 bg-blue-50 text-[#1D4ED8]"
      : "border-slate-200 bg-white text-[#1F2937] hover:border-slate-300 hover:bg-slate-50");

  const panelClass =
    "absolute left-0 top-full z-30 mt-3 " +
    "w-[min(350px,calc(100vw-2rem))] rounded-2xl " +
    "border border-slate-200 bg-white p-5 " +
    "text-[#1F2937] shadow-xl";

  return (
    <section aria-label="Job filters" className="relative">
      <div
        ref={toolbarRef}
        className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        {/* Heading */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              aria-hidden="true"
              className="h-5 w-5 text-[#1D4ED8]"
            />

            <h2 className="text-base font-bold text-[#0E1726]">
              Refine your search
            </h2>
          </div>

          <span className="rounded-full bg-[#F5F6F8] px-3 py-1 text-xs font-semibold text-slate-500">
            {activeCount} active{" "}
            {activeCount === 1 ? "filter" : "filters"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Location */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={activePanel === "location"}
              onClick={() => togglePanel("location")}
              className={pillClass(
                hasLocation,
                activePanel === "location"
              )}
            >
              <MapPin aria-hidden="true" className="h-4 w-4" />
              {appliedFilters.location || "Location"}
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>

            {activePanel === "location" && (
              <div className={panelClass}>
                <label
                  htmlFor="job-location"
                  className="mb-2 block text-sm font-semibold"
                >
                  Preferred location
                </label>

                <input
                  id="job-location"
                  type="text"
                  placeholder="City or location"
                  value={filters.location}
                  onChange={(event) =>
                    updateFilter("location", event.target.value)
                  }
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Salary */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={activePanel === "salary"}
              onClick={() => togglePanel("salary")}
              className={pillClass(
                hasSalary,
                activePanel === "salary"
              )}
            >
              <Wallet aria-hidden="true" className="h-4 w-4" />
              Salary range

              {hasSalary && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D4ED8] text-white">
                  <Check aria-hidden="true" className="h-3 w-3" />
                </span>
              )}

              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>

            {activePanel === "salary" && (
              <div className={panelClass}>
                <div className="mb-5">
                  <h3 className="text-base font-bold text-[#0E1726]">
                    Salary range (CAD/year)
                  </h3>
                </div>

                {/* Salary inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label
                      htmlFor="min-salary"
                      className="mb-2 block text-xs font-semibold text-slate-600"
                    >
                      Minimum
                    </label>

                    <input
                      id="min-salary"
                      type="number"
                      min="0"
                      placeholder="No minimum"
                      value={filters.minSalary}
                      onChange={(event) =>
                        updateFilter(
                          "minSalary",
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="max-salary"
                      className="mb-2 block text-xs font-semibold text-slate-600"
                    >
                      Maximum
                    </label>

                    <input
                      id="max-salary"
                      type="number"
                      min="0"
                      placeholder="No maximum"
                      value={filters.maxSalary}
                      onChange={(event) =>
                        updateFilter(
                          "maxSalary",
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Dual-handle slider */}
                <div className="mt-7 px-1">
                  <Slider.Root
                    aria-label="Salary range"
                    className="relative flex h-6 w-full touch-none select-none items-center"
                    min={0}
                    max={SALARY_MAX}
                    step={SALARY_STEP}
                    minStepsBetweenThumbs={0}
                    value={sliderValues}
                    onValueChange={updateSalarySlider}
                  >
                    <Slider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
                      <Slider.Range className="absolute h-full bg-[#1D4ED8]" />
                    </Slider.Track>

                    <Slider.Thumb
                      aria-label="Minimum salary"
                      className="block h-5 w-5 rounded-full border-[3px] border-[#1D4ED8] bg-white shadow-md outline-none transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-blue-200"
                    />

                    <Slider.Thumb
                      aria-label="Maximum salary"
                      className="block h-5 w-5 rounded-full border-[3px] border-[#1D4ED8] bg-white shadow-md outline-none transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-blue-200"
                    />
                  </Slider.Root>

                  <div className="mt-2 flex justify-between text-xs font-medium text-slate-500">
                    <span>$0</span>
                    <span>$200k+</span>
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-xs font-medium text-red-600"
                  >
                    {error}
                  </p>
                )}

                <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="h-10 flex-1 rounded-xl bg-[#1D4ED8] px-4 text-sm font-bold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Apply salary range
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilters((previous) => ({
                        ...previous,
                        minSalary: "",
                        maxSalary: "",
                      }));
                      setError("");
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Experience */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={activePanel === "experience"}
              onClick={() => togglePanel("experience")}
              className={pillClass(
                hasExperience,
                activePanel === "experience"
              )}
            >
              <GraduationCap
              aria-hidden="true"
              className="h-4 w-4"
              />
              {appliedFilters.experienceLevel || "Experience"}
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>

            {activePanel === "experience" && (
              <div className={panelClass}>
                <label
                  htmlFor="experience-level"
                  className="mb-2 block text-sm font-semibold"
                >
                  Experience level
                </label>

                <select
                  id="experience-level"
                  value={filters.experienceLevel}
                  onChange={(event) =>
                    updateFilter(
                      "experienceLevel",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">All experience levels</option>
                  <option value="Entry Level">Entry Level — 0–2 years</option>
                  <option value="Mid Level">Mid Level — 3–5 years</option>
                  <option value="Senior Level">Senior Level — 6+ years</option>
                </select>
              </div>
            )}
          </div>

          {/* Job type */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={activePanel === "jobType"}
              onClick={() => togglePanel("jobType")}
              className={pillClass(
                hasJobType,
                activePanel === "jobType"
              )}
            >
              <BriefcaseBusiness
                aria-hidden="true"
                className="h-4 w-4"
              />
              {appliedFilters.jobType || "Job type"}
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>

            {activePanel === "jobType" && (
              <div className={panelClass}>
                <label
                  htmlFor="job-type"
                  className="mb-2 block text-sm font-semibold"
                >
                  Job type
                </label>

                <select
                  id="job-type"
                  value={filters.jobType}
                  onChange={(event) =>
                    updateFilter("jobType", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">All job types</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
            )}
          </div>

          {/* Main actions */}
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex h-11 items-center rounded-full bg-[#1D4ED8] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Apply filters
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RotateCcw
              aria-hidden="true"
              className="h-4 w-4"
            />
            Clear all
          </button>
        </div>

        {/* Validation errors outside the salary panel */}
        {error && activePanel !== "salary" && (
          <p
            role="alert"
            className="mt-4 text-sm font-medium text-red-600"
          >
            {error}
          </p>
        )}

      </div>
    </section>
  );
}
