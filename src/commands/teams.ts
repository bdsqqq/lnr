import type { Command } from "commander";
import { getClient } from "../lib/client";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  getOutputFormat,
  outputJson,
  outputQuiet,
  outputTable,
  type OutputOptions,
} from "../lib/output";

interface TeamListOptions extends OutputOptions {
  json?: boolean;
  quiet?: boolean;
}

interface TeamShowOptions extends OutputOptions {
  members?: boolean;
  json?: boolean;
}

export function registerTeamsCommand(program: Command): void {
  program
    .command("teams")
    .alias("t")
    .description("list teams")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .action(async (options: TeamListOptions) => {
      const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

      try {
        const client = getClient();
        const teamsConnection = await client.teams();
        const teams = teamsConnection.nodes;

        if (format === "json") {
          outputJson(
            teams.map((t) => ({
              id: t.id,
              key: t.key,
              name: t.name,
              description: t.description,
            }))
          );
          return;
        }

        if (format === "quiet") {
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
    });

  program
    .command("team <key>")
    .description("show team details")
    .option("--members", "show team members")
    .option("--json", "output as json")
    .action(async (key: string, options: TeamShowOptions) => {
      const format = options.json ? "json" : getOutputFormat(options);

      try {
        const client = getClient();
        const teamsConnection = await client.teams({ filter: { key: { eq: key.toUpperCase() } } });
        const team = teamsConnection.nodes[0];

        if (!team) {
          const allTeams = await client.teams();
          const availableKeys = allTeams.nodes.map((t) => t.key).join(", ");
          exitWithError(
            `team "${key}" not found`,
            `available teams: ${availableKeys}`,
            EXIT_CODES.NOT_FOUND
          );
        }

        if (options.members) {
          const membersConnection = await team.members();
          const members = membersConnection.nodes;

          if (format === "json") {
            outputJson(
              members.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                displayName: m.displayName,
                active: m.active,
              }))
            );
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

        if (format === "json") {
          outputJson({
            id: team.id,
            key: team.key,
            name: team.name,
            description: team.description,
            private: team.private,
            timezone: team.timezone,
          });
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
    });
}
