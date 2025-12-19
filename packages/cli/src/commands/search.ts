import type { Command } from "commander";
import { getClient, searchIssues } from "@bdsqqq/lnr-core";
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
        const issues = await searchIssues(client, query, { team: options.team });

        if (format === "json") {
          outputJson(issues);
          return;
        }

        if (format === "quiet") {
          outputQuiet(issues.map((i) => i.identifier));
          return;
        }

        outputTable(issues, [
          { header: "ID", value: (i) => i.identifier, width: 12 },
          { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
          { header: "STATE", value: (i) => i.state ?? "-", width: 16 },
        ]);
      } catch (error) {
        handleApiError(error);
      }
    });
}
