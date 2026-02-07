/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-02-07T23:40:01.131Z
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import "../lib/arktype-config";
import { type } from "arktype";
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
  getProjectExternalLinks,
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  resolveMilestoneByName,
  resolveProjectByName,
  type Project,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "../router/trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import type { OperationSpec } from "../lib/operation-spec";
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
import { outputCommentThreads } from "../lib/renderers/comments";
import { outputDetail } from "../lib/renderers/detail";
import { projectToDetail } from "../lib/adapters";


export const listProjectsInput = type({
  "team?": type("string").describe("filter by team key"),
  "status?": type("string").describe("filter by status (planned, started, completed, etc)"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const projectInput = type({
  name: type("string").configure({ positional: true }).describe("project name or 'new'"),
  "issues?": type("boolean").describe("list issues in project"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
  "delete?": type("boolean").describe("delete the project"),
  "status?": type("string").describe("set project status"),
  "newName?": type("string").describe("new name for the project"),
  "description?": type("string").describe("project description"),
  "content?": type("string").describe("set project content as markdown"),
  "team?": type("string").describe("team key to associate project with"),
  "lead?": type("string").describe("set lead by email or @me"),
  "startDate?": type("string").describe("set start date (YYYY-MM-DD)"),
  "targetDate?": type("string").describe("set target date (YYYY-MM-DD)"),
  "priority?": type("number").describe("set priority (0=none, 1=urgent, 2=high, 3=normal, 4=low)"),
  "updates?": type("boolean").describe("list project updates"),
  "labels?": type("boolean").describe("list project labels"),
  "showStatus?": type("boolean").describe("show project status details"),
  "links?": type("boolean").describe("list project external links"),
  "milestones?": type("boolean").describe("list project milestones"),
  "react?": type("string").describe("entity id to add reaction (requires --emoji)"),
  "emoji?": type("string").describe("emoji for --react"),
  "unreact?": type("string").describe("reaction id to remove"),
  "subscribe?": type("boolean").describe("subscribe to notifications"),
  "unsubscribe?": type("boolean").describe("unsubscribe from notifications"),
});

type ProjectInput = typeof projectInput.infer;

export const projectMilestoneInput = type({
  nameOrNew: type("string").configure({ positional: true }).describe("milestone name or 'new'"),
  project: type("string").describe("project name (required)"),
  "newName?": type("string").describe("new name for the milestone"),
  "description?": type("string").describe("milestone description"),
  "targetDate?": type("string").describe("target date (YYYY-MM-DD)"),
  "delete?": type("boolean").describe("delete the milestone"),
  "json?": type("boolean").describe("output as json"),
});

type ProjectMilestoneInput = typeof projectMilestoneInput.infer;

const projectColumns: TableColumn<Project>[] = [
  { header: "NAME", value: (p) => truncate(p.name, 30), width: 30 },
  { header: "STATE", value: (p) => p.state ?? "-", width: 12 },
  { header: "PROGRESS", value: (p) => `${Math.round((p.progress ?? 0) * 100)}%`, width: 10 },
  { header: "TARGET", value: (p) => formatDate(p.targetDate), width: 12 },
];

export const projectOperations = ["create", "read", "update", "delete"] as const;
type Operation = (typeof projectOperations)[number];

export const projectMutationFlags: readonly (keyof ProjectInput)[] = [
  "newName", "description", "content", "status", "startDate", "targetDate", "priority", "lead", "team", "react", "emoji", "unreact", "subscribe", "unsubscribe"
] as const;

export function inferOperation(input: ProjectInput): Operation {
  if (input.name === "new") return "create";
  if (input.delete) return "delete";

  for (const flag of projectMutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

export const projectOperationSpec: OperationSpec<ProjectInput, Operation> = {
  command: "project",
  operations: projectOperations,
  mutationFlags: projectMutationFlags,
  inferOperation,
};

async function handleListProjects(
  input: typeof listProjectsInput.infer
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const projects = await listProjects(client, { team: input.team, status: input.status });

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

    if (input.milestones) {
      const milestones = await listMilestones(client, { projectId: project.id });
      if (format === "json") {
        outputJson(milestones);
      } else if (format === "quiet") {
        outputQuiet(milestones.map((m) => m.id));
      } else {
        if (milestones.length === 0) {
          console.log("no milestones");
          return;
        }
        for (const m of milestones) {
          console.log(`${m.name}${m.targetDate ? ` (target: ${formatDate(m.targetDate)})` : ""}`);
        }
      }
      return;
    }

    if (input.links) {
      const links = await getProjectExternalLinks(client, project.id);
      if (format === "json") {
        outputJson(links);
      } else if (format === "quiet") {
        outputQuiet(links.map((l) => l.id));
      } else {
        if (links.length === 0) {
          console.log("no external links");
          return;
        }
        for (const l of links) {
          console.log(`${l.label}: ${l.url}`);
        }
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

    outputDetail(projectToDetail(project));
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



async function handleProjectMilestone(input: ProjectMilestoneInput): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : undefined,
    };
    const format = getOutputFormat(outputOpts);

    const projectId = await resolveProjectByName(client, input.project);

    // determine operation
    const isCreate = input.nameOrNew === "new";
    const isDelete = input.delete === true;
    const isUpdate = !isCreate && !isDelete && (
      input.newName !== undefined ||
      input.description !== undefined ||
      input.targetDate !== undefined
    );
    const isRead = !isCreate && !isDelete && !isUpdate;

    if (isCreate) {
      if (!input.newName) {
        exitWithError("--new-name is required", 'usage: lnr project milestone new --project "..." --new-name "v1.0"');
      }

      const milestone = await createMilestone(client, {
        name: input.newName,
        projectId,
        description: input.description,
        targetDate: input.targetDate,
      });

      if (!milestone) {
        exitWithError("failed to create milestone");
      }

      if (format === "json") {
        outputJson(milestone);
      } else {
        console.log(`created milestone: ${milestone.name}`);
      }
      return;
    }

    const milestoneId = await resolveMilestoneByName(client, projectId, input.nameOrNew);

    if (isDelete) {
      const success = await deleteMilestone(client, milestoneId);
      if (!success) {
        exitWithError(`milestone "${input.nameOrNew}" not found`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(`deleted milestone: ${input.nameOrNew}`);
      return;
    }

    if (isUpdate) {
      const updatePayload: {
        name?: string;
        description?: string;
        targetDate?: string;
      } = {};

      if (input.newName !== undefined) updatePayload.name = input.newName;
      if (input.description !== undefined) updatePayload.description = input.description;
      if (input.targetDate !== undefined) updatePayload.targetDate = input.targetDate;

      const updated = await updateMilestone(client, milestoneId, updatePayload);
      if (!updated) {
        exitWithError(`failed to update milestone "${input.nameOrNew}"`);
      }

      if (format === "json") {
        outputJson(updated);
      } else {
        console.log(`updated milestone: ${updated.name}`);
      }
      return;
    }

    // read: show milestone details
    const milestone = await client.projectMilestone(milestoneId);
    if (!milestone) {
      exitWithError(`milestone "${input.nameOrNew}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (format === "json") {
      outputJson({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        targetDate: milestone.targetDate,
        createdAt: milestone.createdAt,
        updatedAt: milestone.updatedAt,
      });
    } else {
      console.log(`${milestone.name}`);
      if (milestone.description) {
        console.log(`  ${milestone.description}`);
      }
      if (milestone.targetDate) {
        console.log(`  target: ${formatDate(milestone.targetDate)}`);
      }
    }
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

  "project milestone": procedure
    .meta({
      description: "create, show, update, or delete a milestone",
    })
    .input(projectMilestoneInput)
    .mutation(async ({ input }) => {
      await handleProjectMilestone(input);
    }),
});
