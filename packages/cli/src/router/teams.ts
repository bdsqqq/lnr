import { z } from "zod";
import {
  getClient,
  listTeams,
  getTeam,
  getTeamMembers,
  getAvailableTeamKeys,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import { outputJson, outputQuiet, outputTable } from "../lib/output";

const teamsInput = z.object({
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

const teamInput = z.object({
  key: z.string().meta({ positional: true }),
  members: z.boolean().optional(),
  json: z.boolean().optional(),
});

export const teamsRouter = router({
  teams: procedure
    .meta({ aliases: { command: ["t"] }, description: "list teams" })
    .input(teamsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const teams = await listTeams(client);

        if (input.json) {
          outputJson(teams);
          return;
        }

        if (input.quiet) {
          outputQuiet(teams.map((t) => t.key));
          return;
        }

        outputTable(teams, [
          { header: "KEY", value: (t) => t.key, width: 8 },
          { header: "NAME", value: (t) => t.name, width: 24 },
          { header: "DESCRIPTION", value: (t) => t.description ?? "-", width: 40 },
        ]);
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

        if (input.members) {
          const members = await getTeamMembers(client, input.key);

          if (input.json) {
            outputJson(members);
            return;
          }

          console.log(`${team.name} (${team.key}) members:\n`);
          outputTable(members, [
            { header: "NAME", value: (m) => m.name, width: 24 },
            { header: "EMAIL", value: (m) => m.email ?? "-", width: 32 },
            { header: "ACTIVE", value: (m) => (m.active ? "yes" : "no"), width: 8 },
          ]);
          return;
        }

        if (input.json) {
          outputJson(team);
          return;
        }

        console.log(`${team.name} (${team.key})`);
        if (team.description) {
          console.log(team.description);
        }
        console.log(`timezone: ${team.timezone ?? "-"}`);
        console.log(`private: ${team.private ? "yes" : "no"}`);
      } catch (error) {
        handleApiError(error);
      }
    }),
});
