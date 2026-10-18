import UploadResumeForm from "@/app/upload-resume/upload_resume_form";
import ResumeList from "@/components/resume/resume_list";
import BackToDashBoardButton from "@/components/dashboard/BackToDashBoardButton";

export default function ResumePage() {
    return (
        <main className="flex min-h-screen flex-col gap-8 px-4 py-8 md:flex-row md:items-stretch md:gap-8">
            <section className="flex w-full items-center justify-center md:w-1/3">
                <UploadResumeForm />
            </section>
            
            <section className="w-full md:w-2/3">
                <ResumeList />
            </section>

            <section className="fixed right-4 top-4 z-50">
                <BackToDashBoardButton />
            </section>
            
        </main>
    );
}