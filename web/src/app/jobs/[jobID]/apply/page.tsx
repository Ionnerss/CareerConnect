
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

type ApplyPageProps = {
  params: Promise<{ jobID: string }>;
};

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { jobID } = await params;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const { data: job, error } = await supabase
    .from("job")
    .select("id, title, firm_name, location, status")
    .eq("id", jobID)
    .eq("status", "open")
    .maybeSingle();

  if (error || !job) {
    notFound();
  }

  const company = job.firm_name?.trim() || "Company not listed";
  const title = job.title?.trim() || "Untitled position";

  return (
    <main
      className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#0E1726]`}
    >
      <section className="bg-[#0E1726] text-white">
        <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-10 sm:px-6">
          <Link
            href="/jobs"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#B9C9EA] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Link>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#A9C1FF]">
            CareerConnect / Job Application
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Apply for this position
          </h1>

          <h2 className="mt-5 text-xl font-bold">
            {title}
          </h2>

          <div className="mt-3 flex flex-wrap gap-5 text-sm text-[#CBD5E1]">
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {company}
            </span>

            {job.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-10 max-w-[1100px] px-4 pb-16 sm:px-6">
        <section className="rounded-2xl border border-[#E3E6EB] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold">
            Job application
          </h2>

          <p className="mt-2 text-sm text-[#64748B]">
            Complete your application for {title} at {company}.
          </p>

          <div className="mt-8 rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-5 py-10 text-center">
            <p className="text-sm font-semibold text-[#3151D5]">
              Application form
            </p>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
              Personal information, address, education, work experience,
              skills, languages, professional links, and application
              documents will appear here.
            </p>
          </div>

          <div className="mt-8 flex justify-end">
            <Link
              href="/jobs"
              className="rounded-xl border border-[#E3E6EB] px-5 py-3 text-sm font-semibold text-[#475569] transition-colors hover:bg-[#F5F6F8]"
            >
              Back to jobs
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
