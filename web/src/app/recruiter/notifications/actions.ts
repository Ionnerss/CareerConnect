"use server";

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead, setNotificationRead } from "@/lib/recruiter/notifications";

const NOTIFICATIONS_PATH = "/recruiter/notifications";

export async function setNotificationReadAction(notificationId: unknown, read: boolean) {
  const result = await setNotificationRead(notificationId, read);
  if (result.success) revalidatePath(NOTIFICATIONS_PATH);
  return result;
}

export async function markAllNotificationsReadAction() {
  const result = await markAllNotificationsRead();
  if (result.success) revalidatePath(NOTIFICATIONS_PATH);
  return result;
}
