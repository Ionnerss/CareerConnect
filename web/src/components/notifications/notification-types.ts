export type NotificationCategory =
  | "applications"
  | "interviews"
  | "deadlines";

export type NotificationFilter = "all" | "unread" | "read";

export type CareerNotification = {
  id: string;
  recipientId?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  organization: string;
  timestamp: string;
  read: boolean;
  href: string;
  actionLabel: string;
  deadline?: string;
  status?: string;
  applicationId?: string;
  interviewId?: string;
  jobId?: string;
};

export type NotificationDataSource = {
  getNotifications: (
    recipientId: string
  ) => Promise<CareerNotification[]>;

  setReadStatus: (
    notificationId: string,
    read: boolean
  ) => Promise<void>;
};