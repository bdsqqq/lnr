import { z } from "zod";
import { getClient, searchIssues } from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { handleApiError } from "../lib/error";
import {
  getOutputFormat,
  outputJson,
  outputQuiet,
  outputTable,
  truncate,
} from "../lib/output";

const searchInput = z.object({
  query: z.string().meta({ positional: true }).describe("search query"),
  team: z.string().optional().describe("filter by team key"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
});

export const searchRouter = router({
  search: procedure
    .meta({
      description: "search issues",
      aliases: { command: ["s"] },
    })
    .input(searchInput)
    .query(async ({ input }) => {
      const format = input.json ? "json" : input.quiet ? "quiet" : getOutputFormat({});

      try {
        const client = getClient();
        const issues = await searchIssues(client, input.query, { team: input.team });

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
    }),
});
