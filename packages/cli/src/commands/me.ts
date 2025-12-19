import type { Command } from "commander";
import {
  getClient,
  getViewer,
  getMyIssues,
  getMyCreatedIssues,
} from "@bdsqqq/lnr-core";
import { handleApiError } from "../lib/error";
import {
  getOutputFormat,
  outputJson,
  outputQuiet,
  outputTable,
  formatPriority,
  truncate,
  type OutputOptions,
} from "../lib/output";

interface MeOptions extends OutputOptions {
  issues?: boolean;
  created?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export function registerMeCommand(program: Command): void {
  program
    .command("me")
    .description("show current user info")
    .option("--issues", "show my assigned issues")
    .option("--created", "show issues i created")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .action(async (options: MeOptions) => {
      const format = options.json
        ? "json"
        : options.quiet
          ? "quiet"
          : getOutputFormat(options);

      try {
        const client = getClient();

        if (options.issues) {
          const issues = await getMyIssues(client);

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
            { header: "TITLE", value: (i) => truncate(i.title, 40), width: 40 },
            { header: "STATE", value: (i) => i.state ?? "-", width: 16 },
            { header: "PRIORITY", value: (i) => formatPriority(i.priority), width: 10 },
          ]);
          return;
        }

        if (options.created) {
          const issues = await getMyCreatedIssues(client);

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
            { header: "TITLE", value: (i) => truncate(i.title, 40), width: 40 },
            { header: "STATE", value: (i) => i.state ?? "-", width: 16 },
            { header: "PRIORITY", value: (i) => formatPriority(i.priority), width: 10 },
          ]);
          return;
        }

        const viewer = await getViewer(client);

        if (format === "json") {
          outputJson(viewer);
          return;
        }

        if (format === "quiet") {
          console.log(viewer.id);
          return;
        }

        console.log(`${viewer.name}`);
        console.log(`email: ${viewer.email}`);
        if (viewer.displayName && viewer.displayName !== viewer.name) {
          console.log(`display name: ${viewer.displayName}`);
        }
        console.log(`admin: ${viewer.admin ? "yes" : "no"}`);
      } catch (error) {
        handleApiError(error);
      }
    });
}
