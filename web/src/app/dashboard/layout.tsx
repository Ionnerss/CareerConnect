import type { ReactNode } from "react";
import RoleGate from "@/components/app/role-gate";

// This page draws its own header. Recruiters are sent to their account and postings instead.
export default function Layout({ children }: { children: ReactNode }) {
  return <RoleGate audience="job_seeker">{children}</RoleGate>;
}
