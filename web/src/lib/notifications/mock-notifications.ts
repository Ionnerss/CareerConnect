
import type { CareerNotification } from "@/components/notifications/notification-types";

// Frontend demonstration data.
// Replace with authenticated notification records when the
// notification backend is available.

export const initialNotifications: CareerNotification[] = [
  {
    id: "app-1",
    category: "applications",
    title: "Your application is moving forward",
    message:
      "Good news! Your application has progressed to the next stage of the hiring process.",
    organization: "Northstar Technologies",
    timestamp: "2026-11-09T10:30:00-05:00",
    read: false,
    href: "/application-status",
    actionLabel: "View application",
    status: "In review",
  },
  {
    id: "app-2",
    category: "applications",
    title: "Application received",
    message:
      "Your application for the Software Developer position has been successfully received.",
    organization: "Bluepeak Solutions",
    timestamp: "2026-11-08T15:20:00-05:00",
    read: false,
    href: "/application-status",
    actionLabel: "View application",
    status: "Submitted",
  },
  {
    id: "app-3",
    category: "applications",
    title: "Application status updated",
    message:
      "The employer has updated the status of your recent application.",
    organization: "Apex Digital",
    timestamp: "2026-11-07T09:45:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View application",
    status: "Updated",
  },
  {
    id: "app-4",
    category: "applications",
    title: "Application submitted",
    message:
      "Your application was submitted successfully and is awaiting review.",
    organization: "Orbit Systems",
    timestamp: "2026-11-06T11:10:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View application",
    status: "Submitted",
  },
  {
    id: "app-5",
    category: "applications",
    title: "Application reviewed",
    message:
      "The recruitment team has completed its initial review of your application.",
    organization: "Vertex Labs",
    timestamp: "2026-11-05T14:40:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View application",
    status: "Reviewed",
  },
  {
    id: "int-1",
    category: "interviews",
    title: "You've been invited to an interview",
    message:
      "The recruitment team would like to meet with you to discuss your application.",
    organization: "Northstar Technologies",
    timestamp: "2026-11-09T08:15:00-05:00",
    read: false,
    href: "/application-status",
    actionLabel: "View invitation",
    deadline: "2026-11-14T14:00:00-05:00",
  },
  {
    id: "int-2",
    category: "interviews",
    title: "Interview invitation received",
    message:
      "You've received an invitation for an initial interview with the hiring team.",
    organization: "Bluepeak Solutions",
    timestamp: "2026-11-07T13:25:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View invitation",
    deadline: "2026-11-16T10:00:00-05:00",
  },
  {
    id: "int-3",
    category: "interviews",
    title: "Interview details available",
    message:
      "Your interview information is ready for review.",
    organization: "Apex Digital",
    timestamp: "2026-11-06T16:30:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View details",
    deadline: "2026-11-18T11:30:00-05:00",
  },
  {
    id: "int-4",
    category: "interviews",
    title: "Another opportunity to connect",
    message:
      "A recruiter has requested an introductory conversation about your application.",
    organization: "Vertex Labs",
    timestamp: "2026-11-04T10:00:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View invitation",
    deadline: "2026-11-20T09:00:00-05:00",
  },
  {
    id: "due-1",
    category: "deadlines",
    title: "Interview confirmation needed",
    message:
      "Please review and confirm your interview invitation before the deadline.",
    organization: "Northstar Technologies",
    timestamp: "2026-11-09T09:00:00-05:00",
    read: false,
    href: "/application-status",
    actionLabel: "Review deadline",
    deadline: "2026-11-12T23:59:00-05:00",
  },
  {
    id: "due-2",
    category: "deadlines",
    title: "Application closing soon",
    message:
      "An opportunity you're following is approaching its application deadline.",
    organization: "Orbit Systems",
    timestamp: "2026-11-08T12:00:00-05:00",
    read: true,
    href: "/jobs",
    actionLabel: "Browse jobs",
    deadline: "2026-11-15T23:59:00-05:00",
  },
  {
    id: "due-3",
    category: "deadlines",
    title: "Upcoming interview reminder",
    message:
      "Your scheduled interview is approaching. Make sure you're prepared.",
    organization: "Bluepeak Solutions",
    timestamp: "2026-11-07T09:00:00-05:00",
    read: true,
    href: "/application-status",
    actionLabel: "View details",
    deadline: "2026-11-16T10:00:00-05:00",
  },
  {
    id: "due-4",
    category: "deadlines",
    title: "Application deadline reminder",
    message:
      "Remember to complete your application before the opportunity closes.",
    organization: "Vertex Labs",
    timestamp: "2026-11-05T08:30:00-05:00",
    read: true,
    href: "/jobs",
    actionLabel: "Browse jobs",
    deadline: "2026-11-19T23:59:00-05:00",
  },
];
