import { ApplicationStatusCountUI } from "@/components/job-applications/ApplicationStatusCountUI";

export default function PreviewApplicationStatusCountPage() {

  const counts = {
    total: 10,
    inProgress: 4,
    interview: 2,
    offer: 1,
    rejected: 3,
  };

  return (
    <main className="p-8">
      <ApplicationStatusCountUI status_count={counts} />
    </main>
  );
}