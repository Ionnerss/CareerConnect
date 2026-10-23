import { getUserResumes } from "@/lib/resumes/resume_logic";
import ResumeListClient from "@/components/resume/resume_list_client";

export default async function ResumeList() {
    const resumes = await getUserResumes();

    return (
        <section>
            <div className="mb-6">
                <h2 className="text-xl font-extrabold tracking-tight text-[#0E1726]">Your resumes</h2>
            </div>

            <ResumeListClient resumes={resumes} />
        </section>
    );
}