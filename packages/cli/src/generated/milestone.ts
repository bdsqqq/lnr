/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-01-30T20:18:37.130Z
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  resolveProjectByName,
  resolveMilestoneByName,
  type ProjectMilestone,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "../router/trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  formatPriority,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";


export const listMilestonesInput = z.object({
  project: z.string().optional().describe("filter by project name"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const milestoneInput = z.object({
  name: z.string().meta({ positional: true }).describe("milestone name or 'new'"),
  project: z.string().optional().describe("project name (required for new)"),
  newName: z.string().optional().describe("new name for the milestone"),
  description: z.string().optional().describe("milestone description"),
  targetDate: z.string().optional().describe("target date (YYYY-MM-DD)"),
  delete: z.boolean().optional().describe("delete the milestone"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

type MilestoneInput = z.infer<typeof milestoneInput>;

const milestoneColumns: TableColumn<ProjectMilestone>[] = [
  { header: "ID", value: (m) => m.id.slice(0, 8), width: 10 },
  { header: "NAME", value: (m) => truncate(m.name, 30), width: 30 },
  { header: "TARGET_DATE", value: (m) => m.targetDate ? formatDate(m.targetDate) : "-", width: 12 },
];

type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: MilestoneInput): Operation {
  if (input.name === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof MilestoneInput)[] = ["newName", "description", "targetDate"];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

async function handleListMilestones(
  input: z.infer<typeof listMilestonesInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    let projectId: string | undefined;
    if (input.project) {
      projectId = await resolveProjectByName(client, input.project);
    }

    const milestones = await listMilestones(client, projectId ? { projectId } : undefined);

    if (format === "json") {
      outputJson(milestones);
      return;
    }

    if (format === "quiet") {
      outputQuiet(milestones.map((m) => m.id));
      return;
    }

    outputTable(milestones, milestoneColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowMilestone(name: string, input: MilestoneInput): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    if (!input.project) {
      exitWithError("--project is required to find milestone", 'usage: lnr milestone "name" --project "..."');
    }

    const projectId = await resolveProjectByName(client, input.project);
    const milestoneId = await resolveMilestoneByName(client, projectId, name);
    const milestone = await getMilestone(client, milestoneId);

    if (!milestone) {
      exitWithError(`milestone "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (format === "json") {
      outputJson(milestone);
      return;
    }

    if (format === "quiet") {
      console.log(milestone.id);
      return;
    }

    console.log(`${milestone.name}`);
    console.log(`id: ${milestone.id}`);
    console.log(`target date: ${milestone.targetDate ?? "-"}`);
    if (milestone.description) {
      console.log(`description: ${milestone.description}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateMilestone(name: string, input: MilestoneInput): Promise<void> {
  try {
    const client = getClient();

    if (!input.project) {
      exitWithError("--project is required to find milestone", 'usage: lnr milestone "name" --project "..."');
    }

    const projectId = await resolveProjectByName(client, input.project);
    const milestoneId = await resolveMilestoneByName(client, projectId, name);

    const updatePayload: {
      name?: string;
      description?: string;
      targetDate?: string;
    } = {};

    if (input.newName !== undefined) updatePayload.name = input.newName;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.targetDate !== undefined) updatePayload.targetDate = input.targetDate;

    if (Object.keys(updatePayload).length > 0) {
      const result = await updateMilestone(client, milestoneId, updatePayload);
      if (!result) {
        exitWithError(`milestone "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(`updated milestone: ${result.name}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateMilestone(input: MilestoneInput): Promise<void> {
  if (!input.newName) {
    exitWithError("--new-name is required", 'usage: lnr milestone new --new-name "..." --project "..."');
  }

  if (!input.project) {
    exitWithError("--project is required", 'usage: lnr milestone new --new-name "..." --project "..."');
  }

  try {
    const client = getClient();

    const projectId = await resolveProjectByName(client, input.project);

    const milestone = await createMilestone(client, {
      name: input.newName,
      projectId,
      description: input.description,
      targetDate: input.targetDate,
    });

    if (milestone) {
      console.log(`created milestone: ${milestone.name}`);
    } else {
      exitWithError("failed to create milestone");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteMilestone(name: string, _input: MilestoneInput): Promise<void> {
  try {
    const client = getClient();

    if (!_input.project) {
      exitWithError("--project is required to find milestone", 'usage: lnr milestone "name" --project "..." --delete');
    }

    const projectId = await resolveProjectByName(client, _input.project);
    const milestoneId = await resolveMilestoneByName(client, projectId, name);
    const success = await deleteMilestone(client, milestoneId);

    if (!success) {
      exitWithError(`milestone "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`deleted milestone: ${name}`);
  } catch (error) {
    handleApiError(error);
  }
}



export const generatedMilestonesRouter = router({
  milestones: procedure
    .meta({
      description: "list milestones",
      
    })
    .input(listMilestonesInput)
    .query(async ({ input }) => {
      await handleListMilestones(input);
    }),

  milestone: procedure
    .meta({
      description: "show or update a milestone, or create with 'new'",
    })
    .input(milestoneInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateMilestone(input);
          break;
        case "delete":
          await handleDeleteMilestone(input.name, input);
          break;
        
        case "update":
          await handleUpdateMilestone(input.name, input);
          break;
        case "read":
        default:
          await handleShowMilestone(input.name, input);
          break;
      }
    }),
});
