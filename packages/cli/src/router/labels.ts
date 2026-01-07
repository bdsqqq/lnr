import { z } from "zod";
import {
  getClient,
  listLabels,
  getLabel,
  createLabel,
  updateLabel,
  deleteLabel,
  findTeamByKeyOrName,
  getAvailableTeamKeys,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  truncate,
  type OutputOptions,
} from "../lib/output";

const listLabelsInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

const labelInput = z.object({
  id: z.string().meta({ positional: true }).describe("label id or 'new'"),
  name: z.string().optional().describe("label name (required for new)"),
  color: z.string().optional().describe("hex color code"),
  description: z.string().optional().describe("label description"),
  team: z.string().optional().describe("team key (required for new)"),
  delete: z.boolean().optional().describe("delete the label"),
  json: z.boolean().optional().describe("output as json"),
});

export const labelsRouter = router({
  labels: procedure
    .meta({
      description: "list labels",
    })
    .input(listLabelsInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        const labels = await listLabels(client, input.team);

        if (format === "json") {
          outputJson(labels);
          return;
        }

        if (format === "quiet") {
          outputQuiet(labels.map((l) => l.id));
          return;
        }

        outputTable(
          labels,
          [
            { header: "ID", value: (l) => l.id.slice(0, 8), width: 10 },
            { header: "NAME", value: (l) => truncate(l.name, 30), width: 30 },
            { header: "COLOR", value: (l) => l.color ?? "-", width: 10 },
            { header: "DESCRIPTION", value: (l) => truncate(l.description ?? "-", 40), width: 40 },
          ],
          outputOpts
        );
      } catch (error) {
        handleApiError(error);
      }
    }),

  label: procedure
    .meta({
      description: "show label details, create with 'new', update, or delete with --delete",
    })
    .input(labelInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();

        if (input.id === "new") {
          if (!input.name) {
            exitWithError("--name is required", "usage: lnr label new --name \"...\" --team <key>");
          }
          if (!input.team) {
            exitWithError("--team is required", "usage: lnr label new --name \"...\" --team <key>");
          }

          const team = await findTeamByKeyOrName(client, input.team);
          if (!team) {
            const available = (await getAvailableTeamKeys(client)).join(", ");
            exitWithError(
              `team "${input.team}" not found`,
              `available teams: ${available}`,
              EXIT_CODES.NOT_FOUND
            );
          }

          const label = await createLabel(client, {
            name: input.name,
            teamId: team.id,
            color: input.color,
            description: input.description,
          });

          if (label) {
            console.log(`created label: ${label.name}`);
          } else {
            exitWithError("failed to create label");
          }
          return;
        }

        if (input.delete) {
          const success = await deleteLabel(client, input.id);

          if (!success) {
            exitWithError(`label "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }

          console.log(`deleted label: ${input.id}`);
          return;
        }

        if (input.name || input.color || input.description) {
          const success = await updateLabel(client, input.id, {
            name: input.name,
            color: input.color,
            description: input.description,
          });

          if (!success) {
            exitWithError(`label "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }

          console.log(`updated label: ${input.id}`);
          return;
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : undefined,
        };
        const format = getOutputFormat(outputOpts);

        const label = await getLabel(client, input.id);

        if (!label) {
          exitWithError(`label "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
        }

        if (format === "json") {
          outputJson(label);
          return;
        }

        console.log(`${label.name}`);
        if (label.description) {
          console.log(`  ${truncate(label.description, 80)}`);
        }
        console.log();
        console.log(`id:    ${label.id}`);
        console.log(`color: ${label.color ?? "-"}`);
      } catch (error) {
        handleApiError(error);
      }
    }),
});
