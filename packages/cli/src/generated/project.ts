/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-02-05T17:36:40.059Z
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listProjects,
  getProject,
  getProjectIssues,
  createProject,
  deleteProject,
  updateProject,
  findTeamByKeyOrName,
  getAvailableTeamKeys,
  resolveAssignee,
  resolveTeamByKey,
  createReaction,
  deleteReaction,
  createSubscription,
  deleteSubscription,
  findUserSubscription,
  getProjectUpdates,
  getProjectLabels,
  getProjectStatus,
  type Project,
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


export const listProjectsInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  status: z.string().optional().describe("filter by status (planned, started, completed, etc)"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const projectInput = z.object({
  name: z.string().meta({ positional: true }).describe("project name or 'new'"),
  issues: z.boolean().optional().describe("list issues in project"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
  delete: z.boolean().optional().describe("delete the project"),
  status: z.string().optional().describe("set project status"),
  newName: z.string().optional().describe("new name for the project"),
  description: z.string().optional().describe("project description"),
  content: z.string().optional().describe("set project content as markdown"),
  team: z.string().optional().describe("team key to associate project with"),
  lead: z.string().optional().describe("set lead by email or @me"),
  startDate: z.string().optional().describe("set start date (YYYY-MM-DD)"),
  targetDate: z.string().optional().describe("set target date (YYYY-MM-DD)"),
  priority: z.number().optional().describe("set priority (0=none, 1=urgent, 2=high, 3=normal, 4=low)"),
  updates: z.boolean().optional().describe("list project updates"),
  labels: z.boolean().optional().describe("list project labels"),
  showStatus: z.boolean().optional().describe("show project status details"),
  react: z.string().optional().describe("entity id to add reaction (requires --emoji)"),
  emoji: z.string().optional().describe("emoji for --react"),
  unreact: z.string().optional().describe("reaction id to remove"),
  subscribe: z.boolean().optional().describe("subscribe to notifications"),
  unsubscribe: z.boolean().optional().describe("unsubscribe from notifications"),
});

type ProjectInput = z.infer<typeof projectInput>;

const projectColumns: TableColumn<Project>[] = [
  { header: "NAME", value: (p) => truncate(p.name, 30), width: 30 },
  { header: "STATE", value: (p) => p.state ?? "-", width: 12 },
  { header: "PROGRESS", value: (p) => `${Math.round((p.progress ?? 0) * 100)}%`, width: 10 },
  { header: "TARGET", value: (p) => formatDate(p.targetDate), width: 12 },
];

type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: ProjectInput): Operation {
  if (input.name === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof ProjectInput)[] = [
    "newName", "description", "content", "status", "startDate", "targetDate", "priority", "lead", "team", "react", "emoji", "unreact", "subscribe", "unsubscribe"
  ];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

async function handleListProjects(
  input: z.infer<typeof listProjectsInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const projects = await listProjects(client);

    if (format === "json") {
      outputJson(projects);
      return;
    }

    if (format === "quiet") {
      outputQuiet(projects.map((p) => p.id));
      return;
    }

    outputTable(projects, projectColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowProject(
  name: string,
  input: ProjectInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const project = await getProject(client, name);

    if (!project) {
      exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.issues) {
      const issues = await getProjectIssues(client, project.id);
      if (format === "json") {
        outputJson(issues);
      } else if (format === "quiet") {
        outputQuiet(issues.map((i) => i.identifier));
      } else {
        for (const issue of issues) {
          console.log(`${issue.identifier}: ${issue.title}`);
        }
      }
      return;
    }

    // scoped entity handlers (injected from entity-definitions)
    if (input.updates) {
      const updates = await getProjectUpdates(client, project.id);
      if (format === "json") {
        outputJson(updates);
      } else if (format === "quiet") {
        outputQuiet(updates.map((u) => u.id));
      } else {
        for (const u of updates) {
          console.log(`[${u.health}] ${formatDate(u.createdAt)} - ${truncate(u.body.replace(/\n/g, " "), 60)}`);
        }
      }
      return;
    }

    if (input.labels) {
      const labels = await getProjectLabels(client, project.id);
      if (format === "json") {
        outputJson(labels);
      } else if (format === "quiet") {
        outputQuiet(labels.map((l) => l.id));
      } else {
        for (const l of labels) {
          console.log(`${l.name} (${l.color})`);
        }
      }
      return;
    }

    if (input.showStatus) {
      const status = await getProjectStatus(client, project.id);
      if (!status) {
        console.log("no status set");
        return;
      }
      if (format === "json") {
        outputJson(status);
      } else if (format === "quiet") {
        console.log(status.id);
      } else {
        console.log(`${status.name} (${status.type}) - ${status.color}`);
      }
      return;
    }

    if (format === "json") {
      outputJson(project);
      return;
    }

    if (format === "quiet") {
      console.log(project.id);
      return;
    }

    console.log(`${project.name}`);
    if (project.description) {
      console.log(`  ${truncate(project.description, 80)}`);
    }
    console.log();
    console.log(`state:    ${project.state ?? "-"}`);
    console.log(`progress: ${Math.round((project.progress ?? 0) * 100)}%`);
    console.log(`target:   ${formatDate(project.targetDate)}`);
    console.log(`started:  ${formatDate(project.startDate)}`);
    console.log(`created:  ${formatDate(project.createdAt)}`);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateProject(
  name: string,
  input: ProjectInput
): Promise<void> {
  try {
    const client = getClient();
    const project = await getProject(client, name);

    if (!project) {
      exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    const updatePayload: {
      name?: string;
      description?: string;
      content?: string;
      statusId?: string;
      startDate?: string;
      targetDate?: string;
      priority?: number;
      leadId?: string;
      teamIds?: string[];
    } = {};

    if (input.newName) updatePayload.name = input.newName;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.content !== undefined) updatePayload.content = input.content;
    if (input.status !== undefined) updatePayload.statusId = input.status;
    if (input.startDate !== undefined) updatePayload.startDate = input.startDate;
    if (input.targetDate !== undefined) updatePayload.targetDate = input.targetDate;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.lead !== undefined) updatePayload.leadId = await resolveAssignee(client, input.lead);
    if (input.team !== undefined) updatePayload.teamIds = [await resolveTeamByKey(client, input.team)];

    if (Object.keys(updatePayload).length > 0) {
      await updateProject(client, project.id, updatePayload);
      console.log(`updated ${name}`);
    }

    // flag entity handlers (injected from entity-definitions)
    if (input.react) {
      if (!input.emoji) {
        exitWithError("--emoji is required when using --react");
      }
      const success = await createReaction(client, { type: "projectUpdate", id: input.react }, input.emoji);
      if (!success) {
        exitWithError(`failed to add reaction to project update ${input.react.slice(0, 8)}`);
      }
      console.log(`added reaction ${input.emoji} to project update ${input.react.slice(0, 8)}`);
    }

    if (input.unreact) {
      const success = await deleteReaction(client, input.unreact);
      if (!success) {
        exitWithError(`reaction ${input.unreact.slice(0, 8)} not found`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(`removed reaction ${input.unreact.slice(0, 8)}`);
    }

    if (input.subscribe) {
      const subscriptionId = await createSubscription(client, { type: "project", projectId: project.id });
      console.log(`subscribed to ${name} (subscription: ${subscriptionId.slice(0, 8)})`);
    }

    if (input.unsubscribe) {
      const subscriptionId = await findUserSubscription(client, { type: "project", projectId: project.id });
      if (!subscriptionId) {
        exitWithError(`no subscription found for ${name}`, "you may not be subscribed to this project");
      }
      const success = await deleteSubscription(client, subscriptionId);
      if (!success) {
        exitWithError(`failed to remove subscription`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(`unsubscribed from ${name}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateProject(input: ProjectInput): Promise<void> {
  if (!input.newName && !input.description) {
    exitWithError("--new-name is required", 'usage: lnr project new --new-name "..."');
  }

  const projectName = input.newName;
  if (!projectName) {
    exitWithError("--new-name is required", 'usage: lnr project new --new-name "..."');
  }

  try {
    const client = getClient();

    const createPayload: {
      name: string;
      description?: string;
      content?: string;
      teamIds?: string[];
      leadId?: string;
      startDate?: string;
      targetDate?: string;
      priority?: number;
    } = {
      name: projectName,
    };

    if (input.description) createPayload.description = input.description;
    if (input.content) createPayload.content = input.content;
    if (input.team) createPayload.teamIds = [await resolveTeamByKey(client, input.team)];
    if (input.lead) createPayload.leadId = await resolveAssignee(client, input.lead);
    if (input.startDate) createPayload.startDate = input.startDate;
    if (input.targetDate) createPayload.targetDate = input.targetDate;
    if (input.priority !== undefined) createPayload.priority = input.priority;

    const project = await createProject(client, createPayload);

    if (project) {
      console.log(`created project: ${project.name}`);
    } else {
      console.log("created project");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteProject(
  name: string,
  _input: ProjectInput
): Promise<void> {
  try {
    const client = getClient();
    const success = await deleteProject(client, name);

    if (!success) {
      exitWithError(`project "${name}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`deleted project: ${name}`);
  } catch (error) {
    handleApiError(error);
  }
}



export const generatedProjectsRouter = router({
  projects: procedure
    .meta({
      description: "list projects",
      aliases: { command: ["p"] },
    })
    .input(listProjectsInput)
    .query(async ({ input }) => {
      await handleListProjects(input);
    }),

  project: procedure
    .meta({
      description: "show or update a project, or create with 'new'",
    })
    .input(projectInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateProject(input);
          break;
        case "delete":
          await handleDeleteProject(input.name, input);
          break;
        
        case "update":
          await handleUpdateProject(input.name, input);
          break;
        case "read":
        default:
          await handleShowProject(input.name, input);
          break;
      }
    }),
});
