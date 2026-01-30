/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-01-30T20:18:37.129Z
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  archiveIssue,
  findTeamByKeyOrName,
  getAvailableTeamKeys,
  getTeamLabels,
  resolveAssignee,
  priorityFromString,
  resolveStateName,
  resolveIssueIdentifier,
  resolveProjectByName,
  resolveCycleByName,
  createIssueRelation,
  addComment,
  updateComment,
  replyToComment,
  deleteComment,
  createReaction,
  deleteReaction,
  getIssueComments,
  getSubIssues,
  getTeamStates,
  type Issue,
  type ListIssuesFilter,
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


export const listIssuesInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  project: z.string().optional().describe("filter by project name"),
  assignee: z.string().optional().describe("filter by assignee email or @me"),
  state: z.string().optional().describe("filter by state name"),
  priority: z.string().optional().describe("filter by priority"),
  label: z.string().optional().describe("filter by label name"),
  cycle: z.string().optional().describe("filter by cycle"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const issueInput = z.object({
  idOrNew: z.string().meta({ positional: true }).describe("issue identifier (e.g. ENG-123) or 'new'"),
  json: z.boolean().optional().describe("output as json"),
  open: z.boolean().optional().describe("open issue in browser"),
  title: z.string().optional().describe("The issue title."),
  description: z.string().optional().describe("The issue description in markdown format."),
  assignee: z.string().optional().describe("set assignee by email or @me"),
  parent: z.string().optional().describe("set parent issue identifier"),
  priority: z.string().optional().describe("set priority (urgent, high, medium, low, none)"),
  estimate: z.number().optional().describe("set estimate points"),
  team: z.string().optional().describe("team key (required for new)"),
  cycle: z.string().optional().describe("set cycle"),
  project: z.string().optional().describe("set project name"),
  state: z.string().optional().describe("set workflow state"),
  prioritySortOrder: z.number().optional().describe("The position of the issue related to other issues, when ordered by priority."),
  dueDate: z.string().optional().describe("set due date (YYYY-MM-DD)"),
  label: z.string().optional().describe("set label (+name to add, -name to remove)"),
  comment: z.string().optional().describe("add comment to issue"),
  blocks: z.string().optional().describe("add blocks relation to issue"),
  blockedBy: z.string().optional().describe("add blocked-by relation to issue"),
  relatesTo: z.string().optional().describe("add relates-to relation to issue"),
  comments: z.boolean().optional().describe("list comments on issue"),
  editComment: z.string().optional().describe("comment id to edit (requires --text)"),
  text: z.string().optional().describe("text for --edit-comment or --reply-to"),
  replyTo: z.string().optional().describe("comment id to reply to (requires --text)"),
  deleteComment: z.string().optional().describe("comment id to delete"),
  archive: z.boolean().optional().describe("archive the issue"),
  react: z.string().optional().describe("comment id to add reaction (requires --emoji)"),
  emoji: z.string().optional().describe("emoji for --react"),
  unreact: z.string().optional().describe("reaction id to remove"),
  subIssues: z.boolean().optional().describe("list sub-issues"),
});

type IssueInput = z.infer<typeof issueInput>;

const issueColumns: TableColumn<Issue>[] = [
  { header: "ID", value: (i) => i.identifier, width: 10 },
  { header: "STATE", value: (i) => i.state ?? "-", width: 15 },
  { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
  { header: "ASSIGNEE", value: (i) => i.assignee ?? "-", width: 15 },
  { header: "PRIORITY", value: (i) => formatPriority(i.priority), width: 8 },
];

type Operation = "create" | "read" | "update" | "archive";

function inferOperation(input: IssueInput): Operation {
  if (input.idOrNew === "new") return "create";
  if (input.archive) return "archive";

  const mutationFlags: (keyof IssueInput)[] = [
    "state", "assignee", "priority", "label", "comment",
    "editComment", "replyTo", "deleteComment", "react", "unreact",
    "parent", "blocks", "blockedBy", "relatesTo", "title", "description",
    "project", "cycle", "estimate", "dueDate",
  ];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

async function handleListIssues(
  input: z.infer<typeof listIssuesInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const filters: ListIssuesFilter = {};
    
    if (input.team) {
      filters.team = input.team;
    }

    if (input.assignee) {
      filters.assignee = input.assignee;
    }

    if (input.state) {
      filters.state = input.state;
    }

    if (input.label) {
      filters.label = input.label;
    }

    if (input.project) {
      filters.project = input.project;
    }

    const issues = await listIssues(client, filters);

    if (format === "json") {
      outputJson(issues);
      return;
    }

    if (format === "quiet") {
      outputQuiet(issues.map((i) => i.identifier));
      return;
    }

    outputTable(issues, issueColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : undefined,
    };
    const format = getOutputFormat(outputOpts);

    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.comments) {
      const result = await getIssueComments(client, issue.id);
      if (format === "json") {
        outputJson(result.comments);
      } else {
        for (const c of result.comments) {
          console.log(`[${c.id.slice(0, 8)}] ${c.user ?? "unknown"}: ${c.body}`);
        }
      }
      return;
    }

    if (input.subIssues) {
      const subIssues = await getSubIssues(client, issue.id);
      if (format === "json") {
        outputJson(subIssues);
      } else {
        outputTable(subIssues, issueColumns, outputOpts);
      }
      return;
    }

    if (format === "json") {
      outputJson(issue);
      return;
    }

    console.log(`${issue.identifier}: ${issue.title}`);
    if (issue.description) {
      console.log(`  ${truncate(issue.description, 80)}`);
    }
    console.log();
    console.log(`state:    ${issue.state ?? "-"}`);
    console.log(`assignee: ${issue.assignee ?? "-"}`);
    console.log(`priority: ${formatPriority(issue.priority)}`);
    console.log(`created:  ${formatDate(issue.createdAt)}`);
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.editComment && !input.text) {
      exitWithError("--text is required with --edit-comment");
    }
    if (input.replyTo && !input.text) {
      exitWithError("--text is required with --reply-to");
    }
    if (input.react && !input.emoji) {
      exitWithError("--emoji is required with --react");
    }

    const commentOpCount = [input.comment, input.editComment, input.replyTo, input.deleteComment].filter(Boolean).length;
    if (commentOpCount > 1) {
      exitWithError("only one comment operation allowed per invocation", "use --comment, --edit-comment, --reply-to, or --delete-comment separately");
    }

    const reactionOpCount = [input.react, input.unreact].filter(Boolean).length;
    if (reactionOpCount > 1) {
      exitWithError("only one reaction operation allowed per invocation", "use --react or --unreact, not both");
    }

    const updatePayload: Record<string, unknown> = {};
    const rawIssue = await client.issue(issue.id);
    const teamRef = await rawIssue.team;
    if (!teamRef) {
      exitWithError(`issue ${identifier} has no team`);
    }

    if (input.title) {
      updatePayload.title = input.title;
    }

    if (input.description) {
      updatePayload.description = input.description;
    }

    if (input.state) {
      const states = await getTeamStates(client, teamRef.id);
      const targetState = states.find(
        (s) => s.name.toLowerCase() === input.state!.toLowerCase()
      );
      if (!targetState) {
        const available = states.map((s) => s.name).join(", ");
        exitWithError(`state "${input.state}" not found`, `available states: ${available}`);
      }
      updatePayload.stateId = targetState.id;
    }

    if (input.assignee) {
      if (input.assignee === "@me") {
        const viewer = await client.viewer;
        updatePayload.assigneeId = viewer.id;
      } else {
        const users = await client.users({ filter: { email: { eq: input.assignee } } });
        const user = users.nodes[0];
        if (!user) {
          exitWithError(`user "${input.assignee}" not found`);
        }
        updatePayload.assigneeId = user.id;
      }
    }

    if (input.priority) {
      updatePayload.priority = priorityFromString(input.priority);
    }

    if (input.label) {
      const labelInput = input.label;
      const isRemove = labelInput.startsWith("-");
      const labelName = isRemove ? labelInput.slice(1) : labelInput.startsWith("+") ? labelInput.slice(1) : labelInput;

      if (!labelName) {
        exitWithError("label name cannot be empty");
      }

      const labels = await getTeamLabels(client, teamRef.id);
      const targetLabel = labels.find(
        (l) => l.name.toLowerCase() === labelName.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.map((l) => l.name).join(", ");
        exitWithError(`label "${labelName}" not found`, `available labels: ${available}`);
      }

      const currentLabelsData = rawIssue ? await rawIssue.labels() : { nodes: [] };
      const currentLabelIds = currentLabelsData.nodes.map((l) => l.id);

      if (isRemove) {
        updatePayload.labelIds = currentLabelIds.filter((id) => id !== targetLabel.id);
      } else {
        if (!currentLabelIds.includes(targetLabel.id)) {
          updatePayload.labelIds = [...currentLabelIds, targetLabel.id];
        }
      }
    }

    if (input.parent) {
      const parentIssue = await getIssue(client, input.parent);
      if (!parentIssue) {
        exitWithError(`parent issue "${input.parent}" not found`);
      }
      updatePayload.parentId = parentIssue.id;
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateIssue(client, issue.id, updatePayload);
      console.log(`updated ${identifier}`);
    }

    if (input.blocks) {
      const blockedIssue = await getIssue(client, input.blocks);
      if (!blockedIssue) {
        exitWithError(`issue "${input.blocks}" not found`);
      }
      const success = await createIssueRelation(client, issue.id, blockedIssue.id, "blocks");
      if (!success) {
        exitWithError(`failed to create blocks relation`);
      }
      console.log(`${identifier} now blocks ${input.blocks}`);
    }

    if (input.blockedBy) {
      const blockerIssue = await getIssue(client, input.blockedBy);
      if (!blockerIssue) {
        exitWithError(`issue "${input.blockedBy}" not found`);
      }
      const success = await createIssueRelation(client, blockerIssue.id, issue.id, "blocks");
      if (!success) {
        exitWithError(`failed to create blocked-by relation`);
      }
      console.log(`${identifier} is now blocked by ${input.blockedBy}`);
    }

    if (input.relatesTo) {
      const relatedIssue = await getIssue(client, input.relatesTo);
      if (!relatedIssue) {
        exitWithError(`issue "${input.relatesTo}" not found`);
      }
      const success = await createIssueRelation(client, issue.id, relatedIssue.id, "related");
      if (!success) {
        exitWithError(`failed to create relates-to relation`);
      }
      console.log(`${identifier} now relates to ${input.relatesTo}`);
    }

    if (input.comment) {
      await addComment(client, issue.id, input.comment);
      console.log(`commented on ${identifier}`);
    }

    if (input.editComment) {
      await updateComment(client, input.editComment, input.text!);
      console.log(`updated comment ${input.editComment.slice(0, 8)}`);
    }

    if (input.replyTo) {
      await replyToComment(client, issue.id, input.replyTo, input.text!);
      console.log(`replied to comment ${input.replyTo.slice(0, 8)}`);
    }

    if (input.deleteComment) {
      await deleteComment(client, input.deleteComment);
      console.log(`deleted comment ${input.deleteComment.slice(0, 8)}`);
    }

    if (input.react) {
      const success = await createReaction(client, input.react, input.emoji!);
      if (!success) {
        exitWithError(`failed to add reaction to comment ${input.react.slice(0, 8)}`);
      }
      console.log(`added reaction ${input.emoji} to comment ${input.react.slice(0, 8)}`);
    }

    if (input.unreact) {
      const success = await deleteReaction(client, input.unreact);
      if (!success) {
        exitWithError(`reaction ${input.unreact.slice(0, 8)} not found`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(`removed reaction ${input.unreact.slice(0, 8)}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateIssue(input: IssueInput): Promise<void> {
  if (!input.team) {
    exitWithError("--team is required", 'usage: lnr issue new --team ENG --title "..."');
  }

  if (!input.title) {
    exitWithError("--title is required", 'usage: lnr issue new --team ENG --title "..."');
  }

  try {
    const client = getClient();
    const team = await findTeamByKeyOrName(client, input.team);

    if (!team) {
      const available = (await getAvailableTeamKeys(client)).join(", ");
      exitWithError(`team "${input.team}" not found`, `available teams: ${available}`);
    }

    const createPayload: {
      teamId: string;
      title: string;
      description?: string;
      assigneeId?: string;
      priority?: number;
      labelIds?: string[];
      parentId?: string;
      projectId?: string;
      cycleId?: string;
      stateId?: string;
      estimate?: number;
      dueDate?: string;
    } = {
      teamId: team.id,
      title: input.title,
    };

    if (input.description) createPayload.description = input.description;
    if (input.assignee) createPayload.assigneeId = await resolveAssignee(client, input.assignee);
    if (input.priority) createPayload.priority = priorityFromString(input.priority);

    if (input.label) {
      const labels = await getTeamLabels(client, team.id);
      const targetLabel = labels.find(
        (l) => l.name.toLowerCase() === input.label!.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.map((l) => l.name).join(", ");
        exitWithError(`label "${input.label}" not found`, `available labels: ${available}`);
      }
      createPayload.labelIds = [targetLabel.id];
    }

    if (input.parent) createPayload.parentId = await resolveIssueIdentifier(client, input.parent);
    if (input.project) createPayload.projectId = await resolveProjectByName(client, input.project);
    if (input.cycle) createPayload.cycleId = await resolveCycleByName(client, team.id, input.cycle);
    if (input.state) createPayload.stateId = await resolveStateName(client, team.id, input.state);
    if (input.estimate !== undefined) createPayload.estimate = input.estimate;
    if (input.dueDate) createPayload.dueDate = input.dueDate;

    const issue = await createIssue(client, createPayload);

    if (issue) {
      if (input.blocks) {
        const blockedIssueId = await resolveIssueIdentifier(client, input.blocks);
        await createIssueRelation(client, issue.id, blockedIssueId, "blocks");
        console.log(`${issue.identifier} now blocks ${input.blocks}`);
      }

      if (input.blockedBy) {
        const blockerIssueId = await resolveIssueIdentifier(client, input.blockedBy);
        await createIssueRelation(client, blockerIssueId, issue.id, "blocks");
        console.log(`${issue.identifier} is now blocked by ${input.blockedBy}`);
      }

      if (input.relatesTo) {
        const relatedIssueId = await resolveIssueIdentifier(client, input.relatesTo);
        await createIssueRelation(client, issue.id, relatedIssueId, "related");
        console.log(`${issue.identifier} now relates to ${input.relatesTo}`);
      }

      console.log(`created ${issue.identifier}: ${issue.title}`);
    } else {
      console.log("created issue");
    }
  } catch (error) {
    handleApiError(error);
  }
}



async function handleArchiveIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    await archiveIssue(client, issue.id);
    console.log(`archived ${identifier}`);
  } catch (error) {
    handleApiError(error);
  }
}

export const generatedIssuesRouter = router({
  issues: procedure
    .meta({
      description: "list issues",
      aliases: { command: ["i"] },
    })
    .input(listIssuesInput)
    .query(async ({ input }) => {
      await handleListIssues(input);
    }),

  issue: procedure
    .meta({
      description: "show or update a issue, or create with 'new'",
    })
    .input(issueInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateIssue(input);
          break;
        
        case "archive":
          await handleArchiveIssue(input.idOrNew, input);
          break;
        case "update":
          await handleUpdateIssue(input.idOrNew, input);
          break;
        case "read":
        default:
          await handleShowIssue(input.idOrNew, input);
          break;
      }
    }),
});
