
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
};
