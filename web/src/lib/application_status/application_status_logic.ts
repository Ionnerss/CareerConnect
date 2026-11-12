// This is the file to handle logic for Application Status Page and dashboard application status information
import { requireMfaForAction } from "@/lib/auth/require-mfa";

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
    const { supabase, user } = await requireMfaForAction();
    if (!user) return [];

    type ApplicationRow = {
        id: string;
        job_id: string | null;
        status: string | null;
        created_at: string;
    };

    const pageSize = 1000;
    const applications: ApplicationRow[] = [];

    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
            .from("applications")
            .select("id, job_id, status, created_at")
            .eq("applicant_id", user.id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (error) throw error;

        applications.push(...(data ?? []));

        if (!data || data.length < pageSize) break;
    }

    if (applications.length === 0) return [];
    if (!applications?.length) return [];

    const lookupBatchSize = 100;

    const jobIds = [
        ...new Set(
            applications
                .map((application) => application.job_id)
                .filter((id): id is string => id !== null),
        ),
    ];

    const jobBatches = await Promise.all(
        Array.from(
            { length: Math.ceil(jobIds.length / lookupBatchSize) },
            (_, index) =>
                jobIds.slice(
                    index * lookupBatchSize,
                    (index + 1) * lookupBatchSize,
                ),
        ).map(async (ids) => {
            const { data, error } = await supabase
                .from("job")
                .select("id, title, firm_name, location, recruiter_id")
                .in("id", ids);

            if (error) throw error;
            return data ?? [];
        }),
    );

    const jobs = jobBatches.flat();

    const recruiterIds = [
        ...new Set(
            jobs
                .map((job) => job.recruiter_id)
                .filter((id): id is string => id !== null),
        ),
    ];

    const profileBatches = await Promise.all(
        Array.from(
            { length: Math.ceil(recruiterIds.length / lookupBatchSize) },
            (_, index) =>
                recruiterIds.slice(
                    index * lookupBatchSize,
                    (index + 1) * lookupBatchSize,
                ),
        ).map(async (ids) => {
            const { data, error } = await supabase
                .from("profiles_public")
                .select("id, full_name")
                .in("id", ids);

            if (error) throw error;
            return data ?? [];
        }),
    );

    const profilesPublic = profileBatches.flat();

    const jobsById = new Map((jobs ?? []).map((job) => [job.id, job]));

    const profilesPublicById = new Map(
        (profilesPublic ?? []).map((profile) => [profile.id, profile]),
    );

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
                        profilesPublicById.get(job.recruiter_id)?.full_name ?? "",
                }
                : null,
        };
    });
}
