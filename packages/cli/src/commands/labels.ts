import type { Command } from "commander";
import {
  getClient,
  listLabels,
  getLabel,
  createLabel,
  updateLabel,
  deleteLabel,
  findTeamByKeyOrName,
} from "@bdsqqq/lnr-core";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  getOutputFormat,
  outputJson,
  outputQuiet,
  outputTable,
  type OutputOptions,
} from "../lib/output";

interface LabelsListOptions extends OutputOptions {
  team?: string;
  json?: boolean;
  quiet?: boolean;
}

interface LabelShowOptions extends OutputOptions {
  name?: string;
  color?: string;
  delete?: boolean;
  json?: boolean;
}

interface LabelNewOptions extends OutputOptions {
  name: string;
  team?: string;
  color?: string;
  json?: boolean;
}

export function registerLabelsCommand(program: Command): void {
  program
    .command("labels")
    .description("list labels")
    .option("--team <key>", "filter by team")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .action(async (options: LabelsListOptions) => {
      const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

      try {
        const client = getClient();

        let teamId: string | undefined;
        if (options.team) {
          const team = await findTeamByKeyOrName(client, options.team);
          if (!team) {
            exitWithError(`team "${options.team}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }
          teamId = team.id;
        }

        const labels = await listLabels(client, { teamId });

        if (format === "json") {
          outputJson(labels);
          return;
        }

        if (format === "quiet") {
          outputQuiet(labels.map((l) => l.id));
          return;
        }

        outputTable(labels, [
          { header: "ID", value: (l) => l.id.slice(0, 8), width: 10 },
          { header: "NAME", value: (l) => l.name, width: 24 },
          { header: "COLOR", value: (l) => l.color, width: 10 },
          { header: "GROUP", value: (l) => (l.isGroup ? "yes" : "no"), width: 8 },
        ]);
      } catch (error) {
        handleApiError(error);
      }
    });

  program
    .command("label <id>")
    .description("show, update, or delete a label")
    .option("--name <name>", "update label name")
    .option("--color <color>", "update label color")
    .option("--delete", "delete the label")
    .option("--json", "output as json")
    .action(async (id: string, options: LabelShowOptions) => {
      const format = options.json ? "json" : getOutputFormat(options);

      try {
        const client = getClient();

        if (options.delete) {
          const success = await deleteLabel(client, id);
          if (!success) {
            exitWithError("failed to delete label", undefined, EXIT_CODES.GENERAL_ERROR);
          }
          console.log("label deleted");
          return;
        }

        if (options.name || options.color) {
          const updated = await updateLabel(client, id, {
            name: options.name,
            color: options.color,
          });

          if (format === "json") {
            outputJson(updated);
            return;
          }

          console.log(`updated: ${updated.name} (${updated.color})`);
          return;
        }

        const label = await getLabel(client, id);

        if (!label) {
          exitWithError(`label "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
        }

        if (format === "json") {
          outputJson(label);
          return;
        }

        console.log(`${label.name}`);
        console.log(`id: ${label.id}`);
        console.log(`color: ${label.color}`);
        if (label.description) {
          console.log(`description: ${label.description}`);
        }
        console.log(`group: ${label.isGroup ? "yes" : "no"}`);
      } catch (error) {
        handleApiError(error);
      }
    });

  program
    .command("label")
    .command("new")
    .description("create a new label")
    .requiredOption("--name <name>", "label name")
    .option("--team <key>", "team key")
    .option("--color <color>", "label color (hex)")
    .option("--json", "output as json")
    .action(async (options: LabelNewOptions) => {
      const format = options.json ? "json" : getOutputFormat(options);

      try {
        const client = getClient();

        let teamId: string | undefined;
        if (options.team) {
          const team = await findTeamByKeyOrName(client, options.team);
          if (!team) {
            exitWithError(`team "${options.team}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }
          teamId = team.id;
        }

        const label = await createLabel(client, {
          name: options.name,
          color: options.color,
          teamId,
        });

        if (format === "json") {
          outputJson(label);
          return;
        }

        console.log(`created: ${label.name} (${label.id})`);
      } catch (error) {
        handleApiError(error);
      }
    });
}
