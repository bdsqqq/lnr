import type { LinearClient } from "@linear/sdk";
import type { Notification } from "./types";

export async function listNotifications(
  client: LinearClient,
  options?: { unreadOnly?: boolean }
): Promise<Notification[]> {
  const notificationsConnection = await client.notifications();
  let notifications = notificationsConnection.nodes;

  if (options?.unreadOnly) {
    notifications = notifications.filter((n) => !n.readAt);
  }

  const results: Notification[] = [];
  for (const n of notifications) {
    const actor = n.actorId ? await n.actor : null;
    results.push({
      id: n.id,
      type: n.type,
      category: n.category,
      createdAt: n.createdAt,
      readAt: n.readAt ?? null,
      snoozedUntilAt: n.snoozedUntilAt ?? null,
      archivedAt: n.archivedAt ?? null,
      actorId: n.actorId ?? null,
      actorName: actor?.name ?? null,
    });
  }

  return results;
}

export async function getNotification(
  client: LinearClient,
  id: string
): Promise<Notification | null> {
  try {
    const n = await client.notification(id);
    const actor = n.actorId ? await n.actor : null;
    return {
      id: n.id,
      type: n.type,
      category: n.category,
      createdAt: n.createdAt,
      readAt: n.readAt ?? null,
      snoozedUntilAt: n.snoozedUntilAt ?? null,
      archivedAt: n.archivedAt ?? null,
      actorId: n.actorId ?? null,
      actorName: actor?.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function markNotificationRead(
  client: LinearClient,
  id: string
): Promise<boolean> {
  try {
    const result = await client.updateNotification(id, { readAt: new Date() });
    return result.success;
  } catch {
    return false;
  }
}

export async function archiveNotification(
  client: LinearClient,
  id: string
): Promise<boolean> {
  try {
    const result = await client.archiveNotification(id);
    return result.success;
  } catch {
    return false;
  }
}
