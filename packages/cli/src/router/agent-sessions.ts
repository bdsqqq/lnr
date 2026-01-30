import { z } from "zod";
import {
  getClient,
  listAgentSessions,
  getAgentSession,
  updateAgentSession,
  type AgentSession,
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

export const listAgentSessionsInput = z.object({
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
  status: z
    .string()
    .optional()
    .describe("filter by status (active, pending, complete, error, stale)"),
});

export const agentSessionInput = z.object({
  id: z.string().meta({ positional: true }).describe("agent session id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output id only"),
  verbose: z.boolean().optional().describe("show all fields"),
  externalLink: z.string().optional().describe("set external link url"),
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
