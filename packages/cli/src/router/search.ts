import "../lib/arktype-config";
import { type } from "arktype";
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

export const searchInput = type({
  query: type("string").configure({ positional: true }).describe("search query"),
  "team?": type("string").describe("filter by team key"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
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
