
import type { Interview } from "./interview-types";

/**
 * Development-only sample data for previewing interview cards.
 * These are fictional records and must never be shown as real invitations.
 */
export const mockInterviews: Interview[] = [
  {
    id: "preview-001",
    jobTitle: "Software Engineering Intern",
    companyName: "Northstar Technologies",
    employerName: "Sarah Mitchell",
    date: "2026-11-18T10:00:00-05:00",
    durationMinutes: 45,
    status: "Pending",
  },
  {
    id: "preview-002",
    jobTitle: "Frontend Developer Intern",
    companyName: "Maple Digital",
    employerName: "Daniel Chen",
    date: "2026-11-20T14:30:00-05:00",
    durationMinutes: 60,
    status: "Accepted",
  },
  {
    id: "preview-003",
    jobTitle: "Full Stack Developer",
    companyName: "Horizon Labs",
    employerName: "Alex Morgan",
    date: "2026-11-10T09:00:00-05:00",
    durationMinutes: 30,
    status: "Rejected",
  },
  {
    id: "preview-004",
    jobTitle: "QA Automation Intern",
    companyName: "BluePeak Solutions",
    employerName: "Taylor Brooks",
    date: "2026-11-14T11:00:00-05:00",
    durationMinutes: 45,
    status: "Cancelled",
  },
];
