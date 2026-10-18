import { ResumeCard } from "@/components/resume/resume_card";

export default function PreviewResumeCard() { //just preview data to see what each card looks like
  return (
    <main className="p-8">
      <ResumeCard resume={{
              id: "preview_id",
              uploaded_at: new Date().toISOString(),
              file_path: "preview/resume.pdf",
              file_name: "M_L Resume",
              archived_at: null
          }} />
    </main>
  );
}