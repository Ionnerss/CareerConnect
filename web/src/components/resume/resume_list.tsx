import { getUserResumes } from "@/lib/resumes/resume_logic";
import ResumeListClient from "@/components/resume/resume_list_client";

export default async function ResumeList() {
    const resumes = await getUserResumes();

    return (
        <section className="p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Your resumes</h1>
            </div>

            <ResumeListClient resumes={resumes} />
        </section>
    );
}