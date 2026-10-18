import { getUserResumes } from "@/lib/resumes/resume_logic";
import ResumeTabs from "@/components/resume/resume_tabs";
import ResumeListClient from "@/components/resume/resume_list_client";

export default async function ResumeList() {
    const resumes = await getUserResumes();

    return (
        <section className="p-8">
            <div className="mb-6 flex flex-col gap-8">
                <h1 className="text-2xl font-bold">Your resumes</h1>

                <ResumeTabs />
            </div>

            <ResumeListClient resumes={resumes} />
        </section>
    );
}