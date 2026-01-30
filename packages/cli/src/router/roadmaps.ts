import { z } from "zod";
import {
  getClient,
  listRoadmaps,
  getRoadmap,
  findRoadmapByName,
  type Roadmap,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listRoadmapsInput = z.object({
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const roadmapInput = z.object({
  nameOrId: z.string().meta({ positional: true }).describe("roadmap name, slugId, or id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output id only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

const roadmapColumns: TableColumn<Roadmap>[] = [
  { header: "NAME", value: (r) => r.name, width: 32 },
  { header: "OWNER", value: (r) => r.ownerName ?? "-", width: 20 },
  { header: "SLUG", value: (r) => r.slugId, width: 16 },
];

const verboseRoadmapColumns: TableColumn<Roadmap>[] = [
  ...roadmapColumns,
  { header: "COLOR", value: (r) => r.color ?? "-", width: 10 },
  { header: "ID", value: (r) => r.id, width: 36 },
];

export const roadmapsRouter = router({
  roadmaps: procedure
    .meta({ aliases: { command: ["rm"] }, description: "list roadmaps" })
    .input(listRoadmapsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const roadmaps = await listRoadmaps(client);

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(roadmaps);
          return;
        }

        if (format === "quiet") {
          outputQuiet(roadmaps.map((r) => r.id));
          return;
        }

        const columns = input.verbose ? verboseRoadmapColumns : roadmapColumns;
        outputTable(roadmaps, columns, outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    }),

  roadmap: procedure
    .meta({ description: "show roadmap details" })
    .input(roadmapInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        let roadmap = await getRoadmap(client, input.nameOrId);

        if (!roadmap) {
          roadmap = await findRoadmapByName(client, input.nameOrId);
        }

        if (!roadmap) {
          exitWithError(
            `roadmap "${input.nameOrId}" not found`,
            "try: lnr roadmaps",
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(roadmap);
          return;
        }

        if (format === "quiet") {
          console.log(roadmap.id);
          return;
        }

        console.log(`${roadmap.name}`);
        if (roadmap.ownerName) {
          console.log(`owner: ${roadmap.ownerName}`);
        }
        if (roadmap.description) {
          console.log(`description: ${roadmap.description}`);
        }
        console.log(`url: ${roadmap.url}`);
        if (input.verbose) {
          console.log(`slugId: ${roadmap.slugId}`);
          if (roadmap.color) {
            console.log(`color: ${roadmap.color}`);
          }
          console.log(`id: ${roadmap.id}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    }),
});
