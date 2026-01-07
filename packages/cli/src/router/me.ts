import { z } from "zod";
import {
  getClient,
  getViewer,
  getMyIssues,
  getMyCreatedIssues,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import {
  outputJson,
  outputQuiet,
  outputTable,
  formatPriority,
  truncate,
} from "../lib/output";

const meInput = z.object({
  issues: z.boolean().optional().describe("list issues assigned to me"),
  created: z.boolean().optional().describe("list issues created by me"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
});

export const meRouter = router({
  me: procedure
    .meta({
      description: "show current user info",
    })
    .input(meInput)
    .query(async ({ input }) => {
      const client = getClient();

      const format = input.json ? "json" : input.quiet ? "quiet" : "table";

      if (input.issues) {
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

      if (input.created) {
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
    }),
});
