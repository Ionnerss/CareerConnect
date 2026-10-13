
"use client";
import { useState } from "react";

export function JobDetails() {

  const job = {
    id: 1000,
    recruiter_id: 98,
    recruiter_name: "Jake",
    title: "Software Developer",
    firm_name: "Concordia Company",
    experience: "15 Years",
    work_mode: "Hybrid",
    location: "Montreal",
    description: "You will create the next Linkedn. You need at least 15 years of experience.",
    required_skills: "Typescript, React, SQL, Git",
    status: "Open",
    salary: "$100,000",
    created_at: "October 13th"
  };

  function handleApply() {
    // bring you to the application form, I suggest we create another component for this and just import it here...
  }

  function handleBack() {
    // just close the job details and go back to seeing all job postings
  }

  return (
    <main className="flex min-h-screen justify-center px-4 py-10">
      <section className="w-full max-w-5xl rounded-lg border p-8">


        <header className="flex flex-col gap-2 border-b pb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">
              {job.title}
            </h1>

            <button
              type="button"
              onClick={handleBack}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Back
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            {job.firm_name} · {job.location} · {job.work_mode}
          </p>
        </header>


        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">

          <section className="flex flex-col gap-3 md:col-span-2">
            <h2 className="text-lg font-semibold">
              Job Description
            </h2>

            <p className="text-sm leading-6">
              {job.description}
            </p>
          </section>

          <aside className="flex flex-col gap-5 rounded-lg border p-5">

            <h2 className="text-lg font-semibold">
              Job Details
            </h2>

            <hr className="border-border" />

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Company
              </p>
              <p className="text-sm font-medium">
                {job.firm_name}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Location
              </p>
              <p className="text-sm font-medium">
                {job.location}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Work Mode
              </p>
              <p className="text-sm font-medium">
                {job.work_mode}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Experience
              </p>
              <p className="text-sm font-medium">
                {job.experience}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Salary
              </p>
              <p className="text-sm font-medium">
                {job.salary}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Required Skills
              </p>
              <p className="text-sm font-medium">
                {job.required_skills}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Posted
              </p>
              <p className="text-sm font-medium">
                {job.created_at}
              </p>
            </div>

          </aside>

        </div>

        <div className="mt-8 border-t pt-6">
          <button
            type="button"
            onClick={handleApply}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
          >
            Apply for this job
          </button>
        </div>

      </section>
    </main>
  );
}
