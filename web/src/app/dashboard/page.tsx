
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import LogoutButton from "@/components/auth/logout-button";
import JobSearchBar from "@/components/jobs/job-search-bar";
import { getUserApplications } from "@/lib/application_status/application_status_logic";
import RecentApplications from "@/components/job-applications/RecentApplication";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const applications = await getUserApplications();

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold">
            Welcome to CareerConnect
          </h1>

          <p className="mt-2 text-muted-foreground">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>

          <p className="mt-4 text-sm text-muted-foreground">
            Your dashboard is coming soon.
          </p>

          <div className="mt-8">
            <JobSearchBar />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/profile" className={buttonVariants({ size: "lg" })}>
              My profile
            </Link>

            <Link
              href="/upload-resume"
              className={buttonVariants({ size: "lg" })}
            >
              Upload resume
            </Link>

            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl">
        <RecentApplications applications={applications} />
      </div>
    </main>
  );
}
