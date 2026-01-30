import { z } from "zod";
import {
  getClient,
  listInitiatives,
  getInitiative,
  findInitiativeByName,
  type Initiative,
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

export const listInitiativesInput = z.object({
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const initiativeInput = z.object({
  nameOrId: z.string().meta({ positional: true }).describe("initiative name, slugId, or id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output id only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

const initiativeColumns: TableColumn<Initiative>[] = [
  { header: "NAME", value: (i) => i.name, width: 32 },
  { header: "STATUS", value: (i) => i.status, width: 12 },
  { header: "HEALTH", value: (i) => i.health ?? "-", width: 10 },
  { header: "TARGET", value: (i) => i.targetDate ?? "-", width: 12 },
];

const verboseInitiativeColumns: TableColumn<Initiative>[] = [
  ...initiativeColumns,
  { header: "SLUG", value: (i) => i.slugId, width: 16 },
  { header: "ID", value: (i) => i.id, width: 36 },
];

export const initiativesRouter = router({
  initiatives: procedure
    .meta({ aliases: { command: ["init"] }, description: "list initiatives" })
    .input(listInitiativesInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const initiatives = await listInitiatives(client);

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(initiatives);
          return;
        }

        if (format === "quiet") {
          outputQuiet(initiatives.map((i) => i.id));
          return;
        }

        const columns = input.verbose ? verboseInitiativeColumns : initiativeColumns;
        outputTable(initiatives, columns, outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    }),

  initiative: procedure
    .meta({ description: "show initiative details" })
    .input(initiativeInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        let initiative = await getInitiative(client, input.nameOrId);

        if (!initiative) {
          initiative = await findInitiativeByName(client, input.nameOrId);
        }

        if (!initiative) {
          exitWithError(
            `initiative "${input.nameOrId}" not found`,
            "try: lnr initiatives",
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(initiative);
          return;
        }

        if (format === "quiet") {
          console.log(initiative.id);
          return;
        }

        console.log(`${initiative.name}`);
        console.log(`status: ${initiative.status}`);
        if (initiative.health) {
          console.log(`health: ${initiative.health}`);
        }
        if (initiative.description) {
          console.log(`description: ${initiative.description}`);
        }
        if (initiative.targetDate) {
          console.log(`target: ${initiative.targetDate}`);
        }
        console.log(`url: ${initiative.url}`);
        if (input.verbose) {
          console.log(`slugId: ${initiative.slugId}`);
          console.log(`id: ${initiative.id}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    }),
});
