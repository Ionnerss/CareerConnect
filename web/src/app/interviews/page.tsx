import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireMfaForPage } from "@/lib/auth/require-mfa";

import InterviewList from "@/components/interviews/InterviewList";
import type { Interview } from "@/components/interviews/interview-types";
import type { InterviewStatus } from "@/components/interviews/interview-types";

type InterviewRow = {
  id: string;
  recruiter_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  application: {
    job: {
      title: string;
      firm_name: string | null;
    };
  };
};

type RecruiterProfile = {
  id: string;
  full_name: string | null;
};

function mapInterviewStatus(status: string): InterviewStatus {
  switch (status.toLowerCase()) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "declined":
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return "Pending";
  }
}

export default async function InterviewsPage() {
  await requireMfaForPage();

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("interviews")
    .select(`
      id,
      recruiter_id,
      scheduled_at,
      duration_minutes,
      status,
      application:applications!inner(
        job:job!inner(
          title,
          firm_name
        )
      )
    `)
    .eq("applicant_id", user.id)
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Error fetching interviews:", error);
    throw new Error("Unable to load interviews.");
  }

  const interviewRows = (data ?? []) as unknown as InterviewRow[];

  const recruiterIds = [
    ...new Set(interviewRows.map((interview) => interview.recruiter_id)),
  ];

  let recruiters: RecruiterProfile[] = [];

  if (recruiterIds.length > 0) {
    const { data: recruiterData, error: recruiterError } = await supabase
      .from("profiles_public")
      .select("id, full_name")
      .in("id", recruiterIds);

    if (recruiterError) {
      console.error("Error fetching recruiter profiles:", recruiterError);
    } else {
      recruiters = recruiterData ?? [];
    }
  }

  const recruiterMap = new Map(
    recruiters.map((recruiter) => [
      recruiter.id,
      recruiter.full_name ?? "Recruiter",
    ])
  );

  const interviews: Interview[] = interviewRows.map((row) => ({
    id: row.id,
    jobTitle: row.application.job.title,
    companyName: row.application.job.firm_name ?? "Company",
    employerName: recruiterMap.get(row.recruiter_id) ?? "Recruiter",
    date: row.scheduled_at,
    durationMinutes: row.duration_minutes ?? 30,
    status: mapInterviewStatus(row.status),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          My Interviews
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          View and manage your upcoming and past interviews.
        </p>
      </div>

      <InterviewList
        interviews={interviews}
        actionsEnabled={true}
      />
    </main>
  );
}