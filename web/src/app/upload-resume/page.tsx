import UploadResumeForm from "@/app/upload-resume/upload_resume_form";
import ResumeList from "@/components/resume/resume_list";
import { PageBody, PageHero } from "@/components/app/page-hero";

export default function ResumePage() {
    return (
        <main>
            <PageHero
                label="Resume"
                title="Your resume"
                description="Upload a PDF and keep your resumes organised."
            />

            <PageBody>
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                    <section className="w-full md:w-1/3 md:sticky md:top-24">
                        <UploadResumeForm />
                    </section>

                    <section className="w-full min-w-0 rounded-2xl border border-[#E3E6EB] bg-white p-5 sm:p-6 md:w-2/3">
                        <ResumeList />
                    </section>
                </div>
            </PageBody>
        </main>
    );
}
