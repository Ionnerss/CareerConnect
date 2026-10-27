import { ApplicationCard } from "@/components/job-applications/ApplicationCard";

export default function PreviewApplicationCardPage() {

  //Just testing what one card looks like
  const application_card = {
    id: "1",
    status: "In Progress",
    created_at: "18th",
    job: {
      title: "SQA",
      firm_name: "Concordia",
      location: "Montreal",
      recruiter_name: "Jake"
    }
  };

  return (
    <main className="p-8">
      <ApplicationCard application={application_card} />
    </main>
  );

}