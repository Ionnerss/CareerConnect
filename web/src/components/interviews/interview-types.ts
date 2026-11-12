
export type InterviewStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "Cancelled";

export type Interview = {
  id: string;
  jobTitle: string;
  companyName: string;
  employerName: string;
  date: string;
  durationMinutes: number;
  status: InterviewStatus;
};
