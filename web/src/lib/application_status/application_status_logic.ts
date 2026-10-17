// This is the file to handle logic for Application Status Page and dashboard application status information
import { createClient } from "@/lib/supabase/server";

export type ApplicationStatusCount = {
    total: number,
    inProgress: number,
    interview: number,
    offer: number,
    rejected: number;
};

export type ApplicationCardData = {
    id: string;
    status: string | null;
    created_at: string;
    job: {
        title: string;
        firm_name: string | null;
        location: string;
        recruiter_name: string;
    } | null;
};


export async function getUserApplications(): Promise<ApplicationCardData[]> {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return [];

    const { data: applications, error: applicationsError } = await supabase
        .from("applications")
        .select("id, job_id, status, created_at")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false });

    if (applicationsError) throw applicationsError;
    if (!applications?.length) return [];

    const jobIds = [...new Set(applications.map((application) => application.job_id))];

    const { data: jobs, error: jobsError } = await supabase
        .from("job")
        .select("id, title, firm_name, location, recruiter_id")
        .in("id", jobIds);

    if (jobsError) throw jobsError;

    const recruiterIds = [...new Set((jobs ?? []).map((job) => job.recruiter_id))];

    const { data: profiles, error: profilesError } = recruiterIds.length
        ? await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", recruiterIds)
        : { data: [], error: null };

    if (profilesError) throw profilesError;
    const jobsById = new Map((jobs ?? []).map((job) => [job.id, job]));
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return applications.map((application) => {
        const job = jobsById.get(application.job_id);

        return {
            id: application.id,
            status: application.status,
            created_at: application.created_at,
            job: job
                ? {
                      title: job.title,
                      firm_name: job.firm_name,
                      location: job.location,
                      recruiter_name:
                          profilesById.get(job.recruiter_id)?.full_name ?? "",
                  }
                : null,
        };
    });
}
