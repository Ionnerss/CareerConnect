
import type {
  CareerNotification,
  NotificationDataSource,
} from "@/components/notifications/notification-types";

import { initialNotifications } from "./mock-notifications";

/**
 * Frontend-only notification service.
 *
 * This implementation uses mock data until the backend
 * team provides the authenticated notification API.
 *
 * Read/unread changes are stored in memory and reset
 * when the page is refreshed.
 */

let mockNotifications: CareerNotification[] =
  initialNotifications.map((notification) => ({
    ...notification,
  }));

export const notificationService: NotificationDataSource = {
  async getNotifications(
    _recipientId: string
  ): Promise<CareerNotification[]> {
    // TODO: Replace with authenticated backend request.
    void _recipientId;

    return mockNotifications.map((notification) => ({
      ...notification,
    }));
  },

  async setReadStatus(
    notificationId: string,
    read: boolean
  ): Promise<void> {
    // TODO: Replace with backend read-status update.
    mockNotifications = mockNotifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, read }
        : notification
    );
  },
};
