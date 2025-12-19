import type { Command } from "commander";
import { getClient } from "../lib/client";
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
        const viewer = await client.viewer;

        if (options.issues) {
          const issuesConnection = await viewer.assignedIssues({
            filter: { state: { type: { nin: ["completed", "canceled"] } } },
          });
          const issues = issuesConnection.nodes;

          if (format === "json") {
            outputJson(
              await Promise.all(
                issues.map(async (i) => ({
                  id: i.id,
                  identifier: i.identifier,
                  title: i.title,
                  state: (await i.state)?.name,
                  priority: i.priority,
                }))
              )
            );
            return;
          }

          if (format === "quiet") {
            outputQuiet(issues.map((i) => i.identifier));
            return;
          }

          const issuesWithState = await Promise.all(
            issues.map(async (i) => ({
              issue: i,
              stateName: (await i.state)?.name ?? "-",
            }))
          );

          outputTable(issuesWithState, [
            { header: "ID", value: (i) => i.issue.identifier, width: 12 },
            { header: "TITLE", value: (i) => truncate(i.issue.title, 40), width: 40 },
            { header: "STATE", value: (i) => i.stateName, width: 16 },
            { header: "PRIORITY", value: (i) => formatPriority(i.issue.priority), width: 10 },
          ]);
          return;
        }

        if (options.created) {
          const issuesConnection = await viewer.createdIssues({
            filter: { state: { type: { nin: ["completed", "canceled"] } } },
          });
          const issues = issuesConnection.nodes;

          if (format === "json") {
            outputJson(
              await Promise.all(
                issues.map(async (i) => ({
                  id: i.id,
                  identifier: i.identifier,
                  title: i.title,
                  state: (await i.state)?.name,
                  priority: i.priority,
                }))
              )
            );
            return;
          }

          if (format === "quiet") {
            outputQuiet(issues.map((i) => i.identifier));
            return;
          }

          const issuesWithState = await Promise.all(
            issues.map(async (i) => ({
              issue: i,
              stateName: (await i.state)?.name ?? "-",
            }))
          );

          outputTable(issuesWithState, [
            { header: "ID", value: (i) => i.issue.identifier, width: 12 },
            { header: "TITLE", value: (i) => truncate(i.issue.title, 40), width: 40 },
            { header: "STATE", value: (i) => i.stateName, width: 16 },
            { header: "PRIORITY", value: (i) => formatPriority(i.issue.priority), width: 10 },
          ]);
          return;
        }

        if (format === "json") {
          outputJson({
            id: viewer.id,
            name: viewer.name,
            email: viewer.email,
            displayName: viewer.displayName,
            active: viewer.active,
            admin: viewer.admin,
          });
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
