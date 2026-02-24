import "../lib/arktype-config";
import { type } from "arktype";
import {
  getClient,
  listTeams,
  getTeam,
  getTeamMembers,
  getAvailableTeamKeys,
  type Team,
  type TeamMember,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listTeamsInput = type({
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output keys only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const teamInput = type({
  key: type("string").configure({ positional: true }).describe("team key"),
  "members?": type("boolean").describe("list team members"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output id only"),
  "verbose?": type("boolean").describe("show all columns"),
});

const teamColumns: TableColumn<Team>[] = [
  { header: "KEY", value: (t) => t.key, width: 8 },
  { header: "NAME", value: (t) => t.name, width: 24 },
  { header: "DESCRIPTION", value: (t) => truncate(t.description ?? "-", 40), width: 40 },
];

const verboseTeamColumns: TableColumn<Team>[] = [
  ...teamColumns,
  { header: "PRIVATE", value: (t) => (t.private ? "yes" : "no"), width: 8 },
  { header: "TIMEZONE", value: (t) => t.timezone ?? "-", width: 20 },
  { header: "ID", value: (t) => t.id, width: 36 },
];

const memberColumns: TableColumn<TeamMember>[] = [
  { header: "NAME", value: (m) => m.name, width: 24 },
  { header: "EMAIL", value: (m) => m.email ?? "-", width: 32 },
  { header: "ACTIVE", value: (m) => (m.active ? "yes" : "no"), width: 8 },
];

const verboseMemberColumns: TableColumn<TeamMember>[] = [
  ...memberColumns,
  { header: "DISPLAY NAME", value: (m) => m.displayName ?? "-", width: 24 },
  { header: "ID", value: (m) => m.id, width: 36 },
];

export const teamsRouter = router({
  teams: procedure
    .meta({ aliases: { command: ["t"] }, description: "list teams" })
    .input(listTeamsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const teams = await listTeams(client);

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(teams);
          return;
        }

        if (format === "quiet") {
          outputQuiet(teams.map((t) => t.key));
          return;
        }

        const columns = input.verbose ? verboseTeamColumns : teamColumns;
        outputTable(teams, columns, outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    }),

  team: procedure
    .meta({ description: "show team details" })
    .input(teamInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const team = await getTeam(client, input.key);

        if (!team) {
          const availableKeys = (await getAvailableTeamKeys(client)).join(", ");
          exitWithError(
            `team "${input.key}" not found`,
            `available teams: ${availableKeys}`,
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (input.members) {
          const members = await getTeamMembers(client, input.key);

          if (format === "json") {
            outputJson(members);
            return;
          }

          if (format === "quiet") {
            outputQuiet(members.map((m) => m.id));
            return;
          }

          console.log(`${team.name} (${team.key}) members:\n`);
          const cols = input.verbose ? verboseMemberColumns : memberColumns;
          outputTable(members, cols, outputOpts);
          return;
        }

        if (format === "json") {
          outputJson(team);
          return;
        }

        if (format === "quiet") {
          console.log(team.id);
          return;
        }

        console.log(`${team.name} (${team.key})`);
        if (team.description) {
          console.log(team.description);
        }
        console.log(`timezone: ${team.timezone ?? "-"}`);
        console.log(`private: ${team.private ? "yes" : "no"}`);
        if (input.verbose) {
          console.log(`id: ${team.id}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    }),
});
