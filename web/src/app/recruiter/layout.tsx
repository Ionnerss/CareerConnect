import type { ReactNode } from "react";
import AppShell from "@/components/app/app-shell";

// Signed-in frame for recruiters. Job seekers are sent to their dashboard.
export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell audience="recruiter">{children}</AppShell>;
}
