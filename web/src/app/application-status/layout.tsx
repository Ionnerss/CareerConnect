import type { ReactNode } from "react";
import AppShell from "@/components/app/app-shell";

// Signed-in frame (header, font, page colour) for job seekers. Recruiters are sent to their postings.
export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell audience="job_seeker">{children}</AppShell>;
}
