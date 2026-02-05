import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listAgentSessions,
  getAgentSession,
  updateAgentSession,
  getAgentSessionActivities,
  type AgentSession,
  type AgentActivity,
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

export const listAgentSessionsInput = type({
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
  "status?": type("string").describe("filter by status (active, pending, complete, error, stale)"),
});

export const agentSessionInput = type({
  id: type("string").configure({ positional: true }).describe("agent session id"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output id only"),
  "verbose?": type("boolean").describe("show all fields"),
  "externalLink?": type("string").describe("set external link url"),
  "activities?": type("boolean").describe("show session activities"),
});

const sessionColumns: TableColumn<AgentSession>[] = [
  { header: "STATUS", value: (s) => s.status, width: 14 },
  { header: "TYPE", value: (s) => s.type, width: 14 },
  { header: "ISSUE", value: (s) => s.issueIdentifier ?? "-", width: 12 },
  { header: "CREATOR", value: (s) => s.creatorName ?? "-", width: 16 },
  {
    header: "DATE",
    value: (s) => s.createdAt.toISOString().split("T")[0] ?? "",
    width: 12,
  },
];

const verboseSessionColumns: TableColumn<AgentSession>[] = [
  ...sessionColumns,
  { header: "APP USER", value: (s) => s.appUserName ?? "-", width: 16 },
  {
    header: "STARTED",
    value: (s) =>
      s.startedAt ? s.startedAt.toISOString().split("T")[0] ?? "-" : "-",
    width: 12,
  },
  {
    header: "ENDED",
    value: (s) =>
      s.endedAt ? s.endedAt.toISOString().split("T")[0] ?? "-" : "-",
    width: 12,
  },
  { header: "ID", value: (s) => s.id, width: 36 },
];

const activityColumns: TableColumn<AgentActivity>[] = [
  { header: "TYPE", value: (a) => a.type, width: 12 },
  {
    header: "CONTENT",
    value: (a) => {
      if (a.content.action) {
        return `${a.content.action}: ${a.content.parameter ?? ""}`.slice(0, 40);
      }
      return (a.content.body ?? "").slice(0, 40);
    },
    width: 42,
  },
  { header: "USER", value: (a) => a.userName ?? "-", width: 16 },
  {
    header: "DATE",
    value: (a) => a.createdAt.toISOString().split("T")[0] ?? "",
    width: 12,
  },
];

const verboseActivityColumns: TableColumn<AgentActivity>[] = [
  ...activityColumns,
  { header: "SIGNAL", value: (a) => a.signal ?? "-", width: 10 },
  { header: "EPHEMERAL", value: (a) => (a.ephemeral ? "yes" : "no"), width: 10 },
  { header: "ID", value: (a) => a.id, width: 36 },
];

export const agentSessionsRouter = router({
  "agent-sessions": procedure
    .meta({
      aliases: { command: ["as"] },
      description: "list agent sessions (experimental)",
    })
    .input(listAgentSessionsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const sessions = await listAgentSessions(client, {
          status: input.status,
        });

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(sessions);
          return;
        }

        if (format === "quiet") {
          outputQuiet(sessions.map((s) => s.id));
          return;
        }

        const columns = input.verbose ? verboseSessionColumns : sessionColumns;
        outputTable(sessions, columns, outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    }),

  "agent-session": procedure
    .meta({ description: "show agent session details (experimental)" })
    .input(agentSessionInput)
    .mutation(async ({ input }) => {
      try {
        const client = getClient();

        if (input.externalLink !== undefined) {
          const success = await updateAgentSession(client, input.id, {
            externalLink: input.externalLink,
          });
          if (!success) {
            exitWithError(
              `failed to update agent session "${input.id}"`,
              "check the session id and permissions",
              EXIT_CODES.GENERAL_ERROR
            );
          }
          console.log("updated");
          return;
        }

        if (input.activities) {
          const activities = await getAgentSessionActivities(client, input.id);

          const outputOpts: OutputOptions = {
            format: input.json ? "json" : input.quiet ? "quiet" : undefined,
            verbose: input.verbose,
          };
          const format = getOutputFormat(outputOpts);

          if (format === "json") {
            outputJson(activities);
            return;
          }

          if (format === "quiet") {
            outputQuiet(activities.map((a) => a.id));
            return;
          }

          const columns = input.verbose
            ? verboseActivityColumns
            : activityColumns;
          outputTable(activities, columns, outputOpts);
          return;
        }

        const session = await getAgentSession(client, input.id);

        if (!session) {
          exitWithError(
            `agent session "${input.id}" not found`,
            "try: lnr agent-sessions",
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(session);
          return;
        }

        if (format === "quiet") {
          console.log(session.id);
          return;
        }

        console.log(`status: ${session.status}`);
        console.log(`type: ${session.type}`);
        console.log(`created: ${session.createdAt.toISOString()}`);
        if (session.issueIdentifier) {
          console.log(`issue: ${session.issueIdentifier}`);
        }
        if (session.creatorName) {
          console.log(`creator: ${session.creatorName}`);
        }
        if (session.appUserName) {
          console.log(`app user: ${session.appUserName}`);
        }
        if (session.summary) {
          console.log(`summary: ${session.summary}`);
        }
        if (session.externalLink) {
          console.log(`external link: ${session.externalLink}`);
        }
        if (session.startedAt) {
          console.log(`started: ${session.startedAt.toISOString()}`);
        }
        if (session.endedAt) {
          console.log(`ended: ${session.endedAt.toISOString()}`);
        }
        if (input.verbose) {
          console.log(`id: ${session.id}`);
          if (session.issueId) {
            console.log(`issue id: ${session.issueId}`);
          }
          if (session.commentId) {
            console.log(`comment id: ${session.commentId}`);
          }
          if (session.dismissedAt) {
            console.log(`dismissed: ${session.dismissedAt.toISOString()}`);
          }
          if (session.archivedAt) {
            console.log(`archived: ${session.archivedAt.toISOString()}`);
          }
          if (session.plan) {
            console.log(`plan: ${JSON.stringify(session.plan)}`);
          }
        }
      } catch (error) {
        handleApiError(error);
      }
    }),
});
