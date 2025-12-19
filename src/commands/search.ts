import type { Command } from "commander";
import { getClient } from "../lib/client";
import { handleApiError } from "../lib/error";
import {
  getOutputFormat,
  outputJson,
  outputQuiet,
  outputTable,
  truncate,
  type OutputOptions,
} from "../lib/output";

interface SearchOptions extends OutputOptions {
  team?: string;
  json?: boolean;
  quiet?: boolean;
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("search issues")
    .option("--team <key>", "filter by team")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .action(async (query: string, options: SearchOptions) => {
      const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

      try {
        const client = getClient();
        const searchResults = await client.searchIssues(query);
        let issues = searchResults.nodes;

        if (options.team) {
          const teamKey = options.team.toUpperCase();
          issues = issues.filter((issue) => issue.identifier.startsWith(teamKey + "-"));
        }

        if (format === "json") {
          outputJson(
            await Promise.all(
              issues.map(async (issue) => {
                const state = await issue.state;
                return {
                  id: issue.id,
                  identifier: issue.identifier,
                  title: issue.title,
                  state: state?.name,
                  priority: issue.priority,
                  url: issue.url,
                };
              })
            )
          );
          return;
        }

        if (format === "quiet") {
          outputQuiet(issues.map((issue) => issue.identifier));
          return;
        }

        const issuesWithState = await Promise.all(
          issues.map(async (issue) => ({
            issue,
            stateName: (await issue.state)?.name ?? "-",
          }))
        );

        outputTable(issuesWithState, [
          { header: "ID", value: (i) => i.issue.identifier, width: 12 },
          { header: "TITLE", value: (i) => truncate(i.issue.title, 50), width: 50 },
          { header: "STATE", value: (i) => i.stateName, width: 16 },
        ]);
      } catch (error) {
        handleApiError(error);
      }
    });
}
