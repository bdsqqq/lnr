import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listNotifications,
  getNotification,
  markNotificationRead,
  archiveNotification,
  type Notification,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listNotificationsInput = type({
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
  "unread?": type("boolean").describe("show unread only"),
});

export const notificationInput = type({
  id: type("string").configure({ positional: true }).describe("notification id"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output id only"),
  "verbose?": type("boolean").describe("show all fields"),
  "read?": type("boolean").describe("mark as read"),
  "archive?": type("boolean").describe("archive notification"),
});

const notificationColumns: TableColumn<Notification>[] = [
  { header: "TYPE", value: (n) => n.type, width: 20 },
  { header: "CATEGORY", value: (n) => n.category, width: 16 },
  { header: "ACTOR", value: (n) => n.actorName ?? "-", width: 20 },
  { header: "READ", value: (n) => (n.readAt ? "yes" : "no"), width: 6 },
  {
    header: "DATE",
    value: (n) => n.createdAt.toISOString().split("T")[0] ?? "",
    width: 12,
  },
];

const verboseNotificationColumns: TableColumn<Notification>[] = [
  ...notificationColumns,
  {
    header: "SNOOZED",
    value: (n) =>
      n.snoozedUntilAt ? n.snoozedUntilAt.toISOString().split("T")[0] ?? "-" : "-",
    width: 12,
  },
  { header: "ID", value: (n) => n.id, width: 36 },
];

export const notificationsRouter = router({
  notifications: procedure
    .meta({ aliases: { command: ["n"] }, description: "list notifications" })
    .input(listNotificationsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const notifications = await listNotifications(client, {
          unreadOnly: input.unread,
        });

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(notifications);
          return;
        }

        if (format === "quiet") {
          outputQuiet(notifications.map((n) => n.id));
          return;
        }

        const columns = input.verbose
          ? verboseNotificationColumns
          : notificationColumns;
        outputTable(notifications, columns, outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    }),

  notification: procedure
    .meta({ description: "show notification details" })
    .input(notificationInput)
    .mutation(async ({ input }) => {
      try {
        const client = getClient();

        if (input.read) {
          const success = await markNotificationRead(client, input.id);
          if (!success) {
            exitWithError(
              `failed to mark notification "${input.id}" as read`,
              "check the notification id",
              EXIT_CODES.GENERAL_ERROR
            );
          }
          console.log("marked as read");
          return;
        }

        if (input.archive) {
          const success = await archiveNotification(client, input.id);
          if (!success) {
            exitWithError(
              `failed to archive notification "${input.id}"`,
              "check the notification id",
              EXIT_CODES.GENERAL_ERROR
            );
          }
          console.log("archived");
          return;
        }

        const notification = await getNotification(client, input.id);

        if (!notification) {
          exitWithError(
            `notification "${input.id}" not found`,
            "try: lnr notifications",
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(notification);
          return;
        }

        if (format === "quiet") {
          console.log(notification.id);
          return;
        }

        console.log(`type: ${notification.type}`);
        console.log(`category: ${notification.category}`);
        console.log(`date: ${notification.createdAt.toISOString()}`);
        console.log(`read: ${notification.readAt ? "yes" : "no"}`);
        if (notification.actorName) {
          console.log(`actor: ${notification.actorName}`);
        }
        if (notification.snoozedUntilAt) {
          console.log(`snoozed until: ${notification.snoozedUntilAt.toISOString()}`);
        }
        if (input.verbose) {
          console.log(`id: ${notification.id}`);
          if (notification.archivedAt) {
            console.log(`archived: ${notification.archivedAt.toISOString()}`);
          }
        }
      } catch (error) {
        handleApiError(error);
      }
    }),
});
