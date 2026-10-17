import { ApplicationFilters } from "@/components/job-applications/ApplicationFilters";

export default function PreviewApplicationStatusFilterPage() { 

  return ( //Just to display the UI to preview, the buttons will give issue warning because logic is missing but it works. Keep this despite error showing
    <main className="p-8">
      <ApplicationFilters /> 
    </main>
  );

}