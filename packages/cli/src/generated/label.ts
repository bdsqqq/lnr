/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-01-28T19:53:46.466Z
 *
 * Regenerate with: bun run packages/codegen/generate-label-commands.ts
 */

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
  type Label,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "../router/trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listLabelsInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const labelInput = z.object({
  id: z.string().meta({ positional: true }).describe("label id or 'new'"),
  json: z.boolean().optional().describe("output as json"),
  delete: z.boolean().optional().describe("delete the label"),
  team: z.string().optional().describe("team key (required for new)"),
  name: z.string().optional().describe("label name (required for new)"),
  description: z.string().optional().describe("label description"),
  color: z.string().optional().describe("hex color code"),
});

type LabelInput = z.infer<typeof labelInput>;

const labelColumns: TableColumn<Label>[] = [
  { header: "ID", value: (l) => l.id.slice(0, 8), width: 10 },
  { header: "NAME", value: (l) => truncate(l.name, 30), width: 30 },
  { header: "COLOR", value: (l) => l.color ?? "-", width: 10 },
  { header: "DESCRIPTION", value: (l) => truncate(l.description ?? "-", 40), width: 40 },
];

type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: LabelInput): Operation {
  if (input.id === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof LabelInput)[] = ["name", "color", "description"];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

async function handleListLabels(
  input: z.infer<typeof listLabelsInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    let teamId: string | undefined;
    if (input.team) {
      const team = await findTeamByKeyOrName(client, input.team);
      if (!team) {
        const available = await getAvailableTeamKeys(client);
        exitWithError(
          `team not found: ${input.team}`,
          `available teams: ${available.join(", ")}`,
          EXIT_CODES.NOT_FOUND
        );
      }
      teamId = team.id;
    }

    const labels = await listLabels(client, teamId);

    if (format === "json") {
      outputJson(labels);
      return;
    }

    if (format === "quiet") {
      outputQuiet(labels.map((l) => l.id));
      return;
    }

    outputTable(labels, labelColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowLabel(
  id: string,
  input: LabelInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : undefined,
    };
    const format = getOutputFormat(outputOpts);

    const label = await getLabel(client, id);

    if (!label) {
      exitWithError(`label "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
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
}

async function handleUpdateLabel(
  id: string,
  input: LabelInput
): Promise<void> {
  try {
    const client = getClient();

    const updatePayload: {
      name?: string;
      color?: string;
      description?: string;
    } = {};

    if (input.name !== undefined) {
      updatePayload.name = input.name;
    }

    if (input.color !== undefined) {
      updatePayload.color = input.color;
    }

    if (input.description !== undefined) {
      updatePayload.description = input.description;
    }

    if (Object.keys(updatePayload).length > 0) {
      const success = await updateLabel(client, id, updatePayload);
      if (!success) {
        exitWithError(`label "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(`updated label: ${id}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateLabel(input: LabelInput): Promise<void> {
  if (!input.name) {
    exitWithError("--name is required", 'usage: lnr label new --name "..." --team <key>');
  }

  if (!input.team) {
    exitWithError("--team is required", 'usage: lnr label new --name "..." --team <key>');
  }

  try {
    const client = getClient();

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
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteLabel(
  id: string,
  _input: LabelInput
): Promise<void> {
  try {
    const client = getClient();
    const success = await deleteLabel(client, id);

    if (!success) {
      exitWithError(`label "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`deleted label: ${id}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const generatedLabelsRouter = router({
  labels: procedure
    .meta({
      description: "list labels",
    })
    .input(listLabelsInput)
    .query(async ({ input }) => {
      await handleListLabels(input);
    }),

  label: procedure
    .meta({
      description: "show label details, create with 'new', update, or delete with --delete",
    })
    .input(labelInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateLabel(input);
          break;
        case "delete":
          await handleDeleteLabel(input.id, input);
          break;
        case "update":
          await handleUpdateLabel(input.id, input);
          break;
        case "read":
        default:
          await handleShowLabel(input.id, input);
          break;
      }
    }),
});
