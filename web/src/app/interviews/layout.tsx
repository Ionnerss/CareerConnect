
import type { ReactNode } from "react";
import AppShell from "@/components/app/app-shell";

export default function InterviewsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell audience="job_seeker">{children}</AppShell>;
}
