
export type InterviewStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "Expired"
  | "Cancelled";

export type Interview = {
  id: string;
  jobTitle: string;
  companyName: string;
  employerName: string;
  date: string;
  durationMinutes: number;
  status: InterviewStatus;

  // Optional interview details provided by the recruiter.
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
};
